const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Game state management
const rooms = new Map();

class GameRoom {
    constructor(roomId) {
        this.id = roomId;
        this.players = new Map();
        this.images = [];
        this.currentImageIndex = 0;
        this.gameState = 'waiting'; // waiting, submission, ready_check, voting, results, finished
        this.votes = new Map(); // imageIndex -> {playerId: vote}
        this.voteTimes = new Map(); // imageIndex -> {playerId: {vote, timestamp, reactionTime}}
        this.voteStartTime = null; // timestamp when voting started for current image
        this.results = [];
        this.playerStats = new Map(); // playerId -> {totalReactionTime, voteCount, fastestTime, slowestTime}
        this.imageStats = new Map(); // imageIndex -> {totalReactionTime, voteCount, averageTime, result}
    }

    addPlayer(playerId, playerName) {
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
            ready: false,
            hasSubmittedImages: false
        });
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.players.size === 0) {
            rooms.delete(this.id);
        }
    }

    addImage(playerId, imagePath, characterName) {
        this.images.push({
            id: this.images.length,
            path: imagePath,
            characterName: characterName,
            submittedBy: playerId
        });
    }

    setPlayerReady(playerId, ready = true) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).ready = ready;
        }
    }

    areAllPlayersReady() {
        return Array.from(this.players.values()).every(player => player.ready);
    }

    startVoting() {
        this.voteStartTime = Date.now();
    }

    addVote(playerId, imageIndex, vote) {
        if (!this.votes.has(imageIndex)) {
            this.votes.set(imageIndex, new Map());
        }
        if (!this.voteTimes.has(imageIndex)) {
            this.voteTimes.set(imageIndex, new Map());
        }
        
        const voteTime = Date.now();
        const reactionTime = this.voteStartTime ? voteTime - this.voteStartTime : 0;
        
        this.votes.get(imageIndex).set(playerId, vote);
        this.voteTimes.get(imageIndex).set(playerId, {
            vote: vote,
            timestamp: voteTime,
            reactionTime: reactionTime
        });
        
        // Update player stats
        this.updatePlayerStats(playerId, reactionTime);
        
        // Update image stats
        this.updateImageStats(imageIndex, reactionTime);
    }

    updatePlayerStats(playerId, reactionTime) {
        if (!this.playerStats.has(playerId)) {
            this.playerStats.set(playerId, {
                totalReactionTime: 0,
                voteCount: 0,
                fastestTime: Infinity,
                slowestTime: 0
            });
        }
        
        const stats = this.playerStats.get(playerId);
        stats.totalReactionTime += reactionTime;
        stats.voteCount += 1;
        stats.fastestTime = Math.min(stats.fastestTime, reactionTime);
        stats.slowestTime = Math.max(stats.slowestTime, reactionTime);
    }

    updateImageStats(imageIndex, reactionTime) {
        if (!this.imageStats.has(imageIndex)) {
            this.imageStats.set(imageIndex, {
                totalReactionTime: 0,
                voteCount: 0,
                averageTime: 0
            });
        }
        
        const stats = this.imageStats.get(imageIndex);
        stats.totalReactionTime += reactionTime;
        stats.voteCount += 1;
        stats.averageTime = stats.totalReactionTime / stats.voteCount;
    }

    getVotesForCurrentImage() {
        const votes = this.votes.get(this.currentImageIndex) || new Map();
        return {
            smash: Array.from(votes.values()).filter(vote => vote === 'smash').length,
            pass: Array.from(votes.values()).filter(vote => vote === 'pass').length,
            playerVotes: Object.fromEntries(votes)
        };
    }

    hasAllPlayersVoted() {
        const votes = this.votes.get(this.currentImageIndex) || new Map();
        return votes.size === this.players.size;
    }

    generateFinalStats() {
        const playerRankings = [];
        
        for (const [playerId, stats] of this.playerStats) {
            const player = this.players.get(playerId);
            if (player && stats.voteCount > 0) {
                const averageTime = stats.totalReactionTime / stats.voteCount;
                playerRankings.push({
                    playerId: playerId,
                    playerName: player.name,
                    averageTime: averageTime,
                    fastestTime: stats.fastestTime === Infinity ? 0 : stats.fastestTime,
                    slowestTime: stats.slowestTime,
                    totalVotes: stats.voteCount
                });
            }
        }
        
        // Sort by average time (fastest first)
        const fastestRanking = [...playerRankings].sort((a, b) => a.averageTime - b.averageTime);
        // Sort by average time (slowest first)
        const slowestRanking = [...playerRankings].sort((a, b) => b.averageTime - a.averageTime);
        
        // Generate image stats
        const imageRankings = [];
        for (const [imageIndex, stats] of this.imageStats) {
            const image = this.images[imageIndex];
            const result = this.results[imageIndex];
            if (image && stats.voteCount > 0) {
                imageRankings.push({
                    imageIndex: imageIndex,
                    characterName: image.characterName,
                    imagePath: image.path,
                    averageTime: stats.averageTime,
                    voteCount: stats.voteCount,
                    result: result ? result.result : 'unknown'
                });
            }
        }
        
        // Sort by average time (fastest decisions first)
        const fastestDecisions = [...imageRankings].sort((a, b) => a.averageTime - b.averageTime);
        const slowestDecisions = [...imageRankings].sort((a, b) => b.averageTime - a.averageTime);
        
        return {
            fastestPlayer: fastestRanking[0] || null,
            slowestPlayer: slowestRanking[0] || null,
            allPlayers: fastestRanking,
            imageStats: {
                fastestDecision: fastestDecisions[0] || null,
                slowestDecision: slowestDecisions[0] || null,
                allImages: fastestDecisions
            }
        };
    }

    getGameState() {
        return {
            roomId: this.id,
            players: Array.from(this.players.values()),
            gameState: this.gameState,
            currentImageIndex: this.currentImageIndex,
            totalImages: this.images.length,
            currentImage: this.images[this.currentImageIndex] || null,
            results: this.results,
            voteStartTime: this.voteStartTime
        };
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomId, playerName }) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new GameRoom(roomId));
        }

        const room = rooms.get(roomId);
        room.addPlayer(socket.id, playerName);
        socket.join(roomId);

        socket.emit('joined_room', room.getGameState());
        socket.to(roomId).emit('player_joined', room.getGameState());
        
        console.log(`${playerName} joined room ${roomId}`);
    });

    socket.on('submit_image', ({ roomId, imagePath, characterName }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.addImage(socket.id, imagePath, characterName);
            room.players.get(socket.id).hasSubmittedImages = true;
            
            io.to(roomId).emit('image_submitted', {
                playerName: room.players.get(socket.id).name,
                characterName: characterName
            });
        }
    });

    socket.on('player_ready', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.setPlayerReady(socket.id, true);
            
            if (room.areAllPlayersReady() && room.images.length > 0) {
                room.gameState = 'voting';
                room.currentImageIndex = 0;
                room.startVoting(); // Start timing for first image
                io.to(roomId).emit('game_start', room.getGameState());
            } else {
                io.to(roomId).emit('player_ready_update', room.getGameState());
            }
        }
    });

    socket.on('vote', ({ roomId, vote }) => {
        const room = rooms.get(roomId);
        if (room && room.gameState === 'voting') {
            room.addVote(socket.id, room.currentImageIndex, vote);
            
            if (room.hasAllPlayersVoted()) {
                const votes = room.getVotesForCurrentImage();
                const currentImage = room.images[room.currentImageIndex];
                const result = votes.smash > votes.pass ? 'smashed' : 'passed';
                
                room.results.push({
                    image: currentImage,
                    result: result,
                    votes: votes
                });

                io.to(roomId).emit('vote_results', {
                    image: currentImage,
                    result: result,
                    votes: votes
                });

                setTimeout(() => {
                    room.currentImageIndex++;
                    if (room.currentImageIndex >= room.images.length) {
                        room.gameState = 'finished';
                        const finalStats = room.generateFinalStats();
                        io.to(roomId).emit('game_finished', {
                            results: room.results,
                            gameState: room.getGameState(),
                            stats: finalStats
                        });
                    } else {
                        room.startVoting(); // Start timing for next image
                        io.to(roomId).emit('next_image', room.getGameState());
                    }
                }, 3000);
            } else {
                io.to(roomId).emit('vote_cast', {
                    playerName: room.players.get(socket.id).name,
                    votesCount: room.votes.get(room.currentImageIndex).size,
                    totalPlayers: room.players.size
                });
            }
        }
    });

    socket.on('disconnect', () => {
        // Find and remove player from all rooms
        for (const [roomId, room] of rooms) {
            if (room.players.has(socket.id)) {
                const playerName = room.players.get(socket.id).name;
                room.removePlayer(socket.id);
                socket.to(roomId).emit('player_left', {
                    playerName: playerName,
                    gameState: room.getGameState()
                });
                console.log(`${playerName} left room ${roomId}`);
                break;
            }
        }
    });
});

// Image upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({
        success: true,
        imagePath: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});