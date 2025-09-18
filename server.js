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
        this.results = [];
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

    addVote(playerId, imageIndex, vote) {
        if (!this.votes.has(imageIndex)) {
            this.votes.set(imageIndex, new Map());
        }
        this.votes.get(imageIndex).set(playerId, vote);
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

    getGameState() {
        return {
            roomId: this.id,
            players: Array.from(this.players.values()),
            gameState: this.gameState,
            currentImageIndex: this.currentImageIndex,
            totalImages: this.images.length,
            currentImage: this.images[this.currentImageIndex] || null,
            results: this.results
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
                        io.to(roomId).emit('game_finished', {
                            results: room.results,
                            gameState: room.getGameState()
                        });
                    } else {
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