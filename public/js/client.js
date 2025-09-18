class SmashOrPassGame {
    constructor() {
        this.socket = io();
        this.currentRoom = null;
        this.playerName = '';
        this.gameState = 'welcome';
        
        this.initializeElements();
        this.bindEvents();
        this.setupSocketListeners();
    }

    initializeElements() {
        // Screens
        this.screens = {
            welcome: document.getElementById('welcome-screen'),
            lobby: document.getElementById('lobby-screen'),
            game: document.getElementById('game-screen'),
            results: document.getElementById('results-screen'),
            finalResults: document.getElementById('final-results-screen')
        };

        // Welcome screen elements
        this.playerNameInput = document.getElementById('player-name');
        this.roomIdInput = document.getElementById('room-id');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.createRoomBtn = document.getElementById('create-room-btn');

        // Lobby screen elements
        this.currentRoomIdSpan = document.getElementById('current-room-id');
        this.leaveRoomBtn = document.getElementById('leave-room-btn');
        this.playersListDiv = document.getElementById('players-list');
        this.playerCountSpan = document.getElementById('player-count');
        this.imageUpload = document.getElementById('image-upload');
        this.characterNameInput = document.getElementById('character-name');
        this.uploadBtn = document.getElementById('upload-btn');
        this.submissionStatus = document.getElementById('submission-status');
        this.readyBtn = document.getElementById('ready-btn');
        this.readyStatus = document.getElementById('ready-status');

        // Game screen elements
        this.currentRoundSpan = document.getElementById('current-round');
        this.totalRoundsSpan = document.getElementById('total-rounds');
        this.gameStatus = document.getElementById('game-status');
        this.characterNameDisplay = document.getElementById('character-name-display');
        this.currentImage = document.getElementById('current-image');
        this.passBtn = document.getElementById('pass-btn');
        this.smashBtn = document.getElementById('smash-btn');
        this.votingStatus = document.getElementById('voting-status');

        // Results screen elements
        this.resultSummary = document.getElementById('result-summary');
        this.resultCharacter = document.getElementById('result-character');
        this.resultImage = document.getElementById('result-image');
        this.voteCounts = document.getElementById('vote-counts');
        this.playerVotes = document.getElementById('player-votes');
        this.waitingForNext = document.getElementById('waiting-for-next');

        // Final results elements
        this.finalResultsList = document.getElementById('final-results-list');
        this.playAgainBtn = document.getElementById('play-again-btn');
        this.leaveGameBtn = document.getElementById('leave-game-btn');

        // Notifications
        this.notifications = document.getElementById('notifications');
    }

    bindEvents() {
        // Welcome screen events
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // Lobby screen events
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        this.uploadBtn.addEventListener('click', () => this.imageUpload.click());
        this.imageUpload.addEventListener('change', () => this.handleImageUpload());
        this.readyBtn.addEventListener('click', () => this.setReady());

        // Game screen events
        this.passBtn.addEventListener('click', () => this.vote('pass'));
        this.smashBtn.addEventListener('click', () => this.vote('smash'));

        // Final results events
        this.playAgainBtn.addEventListener('click', () => this.playAgain());
        this.leaveGameBtn.addEventListener('click', () => this.leaveRoom());
    }

    setupSocketListeners() {
        this.socket.on('joined_room', (gameState) => {
            this.currentRoom = gameState.roomId;
            this.showScreen('lobby');
            this.updateLobby(gameState);
        });

        this.socket.on('player_joined', (gameState) => {
            this.updateLobby(gameState);
            this.showNotification(`${gameState.players[gameState.players.length - 1]?.name} joined the room!`, 'info');
        });

        this.socket.on('player_left', ({ playerName, gameState }) => {
            this.updateLobby(gameState);
            this.showNotification(`${playerName} left the room`, 'warning');
        });

        this.socket.on('image_submitted', ({ playerName, characterName }) => {
            this.showNotification(`${playerName} submitted ${characterName}!`, 'success');
            this.updateSubmissionStatus();
        });

        this.socket.on('player_ready_update', (gameState) => {
            this.updateReadyStatus(gameState);
        });

        this.socket.on('game_start', (gameState) => {
            this.showScreen('game');
            this.updateGameScreen(gameState);
            this.showNotification('🎮 Game starting!', 'success');
        });

        this.socket.on('vote_cast', ({ playerName, votesCount, totalPlayers }) => {
            this.votingStatus.innerHTML = `<p>Vote cast! Waiting for ${totalPlayers - votesCount} more players...</p>`;
        });

        this.socket.on('vote_results', ({ image, result, votes }) => {
            this.showVoteResults(image, result, votes);
        });

        this.socket.on('next_image', (gameState) => {
            this.showScreen('game');
            this.updateGameScreen(gameState);
        });

        this.socket.on('game_finished', ({ results, gameState }) => {
            this.showFinalResults(results);
        });

        this.socket.on('disconnect', () => {
            this.showNotification('Disconnected from server', 'error');
        });
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        this.screens[screenName].classList.add('active');
        this.gameState = screenName;
    }

    joinRoom() {
        const playerName = this.playerNameInput.value.trim();
        const roomId = this.roomIdInput.value.trim() || this.generateRoomId();

        if (!playerName) {
            this.showNotification('Please enter your name!', 'error');
            return;
        }

        this.playerName = playerName;
        this.socket.emit('join_room', { roomId, playerName });
    }

    createRoom() {
        const playerName = this.playerNameInput.value.trim();
        if (!playerName) {
            this.showNotification('Please enter your name!', 'error');
            return;
        }

        const roomId = this.generateRoomId();
        this.roomIdInput.value = roomId;
        this.joinRoom();
    }

    leaveRoom() {
        if (this.currentRoom) {
            this.socket.disconnect();
            this.socket.connect();
            this.currentRoom = null;
            this.showScreen('welcome');
            this.resetForm();
        }
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    resetForm() {
        this.playerNameInput.value = '';
        this.roomIdInput.value = '';
        this.characterNameInput.value = '';
        this.submissionStatus.innerHTML = '';
        this.readyStatus.innerHTML = '';
    }

    updateLobby(gameState) {
        this.currentRoomIdSpan.textContent = gameState.roomId;
        this.playerCountSpan.textContent = gameState.players.length;
        
        this.playersListDiv.innerHTML = gameState.players.map(player => 
            `<div class="player ${player.ready ? 'ready' : ''}">
                ${player.name} ${player.ready ? '✅' : '⏳'}
            </div>`
        ).join('');

        this.updateReadyStatus(gameState);
    }

    updateReadyStatus(gameState) {
        const readyPlayers = gameState.players.filter(p => p.ready).length;
        const totalPlayers = gameState.players.length;
        
        this.readyStatus.innerHTML = `${readyPlayers}/${totalPlayers} players ready`;
        
        if (readyPlayers === totalPlayers && totalPlayers > 1 && gameState.totalImages > 0) {
            this.readyStatus.innerHTML += ' - Starting game...';
        }
    }

    async handleImageUpload() {
        const file = this.imageUpload.files[0];
        const characterName = this.characterNameInput.value.trim();

        if (!file || !characterName) {
            this.showNotification('Please select an image and enter a character name!', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.socket.emit('submit_image', {
                    roomId: this.currentRoom,
                    imagePath: result.imagePath,
                    characterName: characterName
                });

                this.characterNameInput.value = '';
                this.imageUpload.value = '';
                this.readyBtn.disabled = false;
                this.showNotification(`Image of ${characterName} uploaded successfully!`, 'success');
            } else {
                this.showNotification('Upload failed!', 'error');
            }
        } catch (error) {
            this.showNotification('Upload error!', 'error');
            console.error('Upload error:', error);
        }
    }

    updateSubmissionStatus() {
        // This could be enhanced to show more detailed submission status
    }

    setReady() {
        this.socket.emit('player_ready', { roomId: this.currentRoom });
        this.readyBtn.disabled = true;
        this.readyBtn.textContent = 'Ready! ✅';
        this.showNotification('You are ready! Waiting for other players...', 'info');
    }

    updateGameScreen(gameState) {
        this.currentRoundSpan.textContent = gameState.currentImageIndex + 1;
        this.totalRoundsSpan.textContent = gameState.totalImages;
        
        if (gameState.currentImage) {
            this.characterNameDisplay.textContent = gameState.currentImage.characterName;
            this.currentImage.src = gameState.currentImage.path;
            this.currentImage.style.display = 'block';
        }

        this.passBtn.disabled = false;
        this.smashBtn.disabled = false;
        this.votingStatus.innerHTML = '';
    }

    vote(voteType) {
        this.socket.emit('vote', { roomId: this.currentRoom, vote: voteType });
        this.passBtn.disabled = true;
        this.smashBtn.disabled = true;
        this.votingStatus.innerHTML = `<p>You voted ${voteType.toUpperCase()}! Waiting for other players...</p>`;
    }

    showVoteResults(image, result, votes) {
        this.showScreen('results');
        
        this.resultCharacter.textContent = image.characterName;
        this.resultImage.src = image.path;
        
        const resultText = result === 'smashed' ? '💖 SMASHED!' : '❌ PASSED!';
        const resultColor = result === 'smashed' ? '#e74c3c' : '#95a5a6';
        
        this.resultSummary.innerHTML = `<h2 style="color: ${resultColor}">${resultText}</h2>`;
        
        this.voteCounts.innerHTML = `
            <div class="vote-count smash">💖 SMASH: ${votes.smash}</div>
            <div class="vote-count pass">❌ PASS: ${votes.pass}</div>
        `;

        // Show individual player votes (if available)
        this.playerVotes.innerHTML = '';

        this.waitingForNext.innerHTML = '<p>Next image in 3 seconds...</p>';
    }

    showFinalResults(results) {
        this.showScreen('finalResults');
        
        this.finalResultsList.innerHTML = results.map((result, index) => `
            <div class="final-result-item">
                <div class="result-number">#${index + 1}</div>
                <div class="result-image-thumb">
                    <img src="${result.image.path}" alt="${result.image.characterName}">
                </div>
                <div class="result-info">
                    <h4>${result.image.characterName}</h4>
                    <p class="result-verdict ${result.result}">${result.result.toUpperCase()}</p>
                    <p class="vote-breakdown">💖 ${result.votes.smash} - ❌ ${result.votes.pass}</p>
                </div>
            </div>
        `).join('');
    }

    playAgain() {
        // Reset game state and return to lobby
        this.showScreen('lobby');
        this.readyBtn.disabled = false;
        this.readyBtn.textContent = 'I\'m Ready!';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.notifications.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SmashOrPassGame();
});