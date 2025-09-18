class SmashOrPassGame {
    constructor() {
        this.socket = io();
        this.currentRoom = null;
        this.playerName = '';
        this.gameState = 'welcome';
        this.timerInterval = null;
        this.voteStartTime = null;
        this.currentVote = null;
        this.isCreator = false;
        this.hasConfirmedVote = false;
        
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
        
        // New upload UI elements
        this.imageSelectionStep = document.getElementById('image-selection-step');
        this.imagePreviewStep = document.getElementById('image-preview-step');
        this.chooseImageBtn = document.getElementById('choose-image-btn');
        this.imagePreview = document.getElementById('image-preview');
        this.changeImageBtn = document.getElementById('change-image-btn');
        this.cancelUploadBtn = document.getElementById('cancel-upload-btn');
        this.confirmUploadBtn = document.getElementById('confirm-upload-btn');
        
        this.submissionStatus = document.getElementById('submission-status');
        this.readyBtn = document.getElementById('ready-btn');
        this.readyStatus = document.getElementById('ready-status');

        // Game screen elements
        this.currentRoundSpan = document.getElementById('current-round');
        this.totalRoundsSpan = document.getElementById('total-rounds');
        this.voteTimer = document.getElementById('vote-timer');
        this.gameStatus = document.getElementById('game-status');
        this.characterNameDisplay = document.getElementById('character-name-display');
        this.currentImage = document.getElementById('current-image');
        this.passBtn = document.getElementById('pass-btn');
        this.smashBtn = document.getElementById('smash-btn');
        this.confirmVoteBtn = document.getElementById('confirm-vote-btn');
        this.selectedVoteDiv = document.getElementById('selected-vote');
        this.nextImageBtn = document.getElementById('next-image-btn');
        this.creatorControls = document.getElementById('creator-controls');
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
        if (this.joinRoomBtn) {
            this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        }
        
        if (this.createRoomBtn) {
            this.createRoomBtn.addEventListener('click', () => this.createRoom());
        }
        
        if (this.playerNameInput) this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        if (this.roomIdInput) this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // Lobby screen events
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // New upload UI events
        this.chooseImageBtn.addEventListener('click', () => this.imageUpload.click());
        this.changeImageBtn.addEventListener('click', () => this.imageUpload.click());
        this.imageUpload.addEventListener('change', (e) => this.handleImageSelection(e));
        this.cancelUploadBtn.addEventListener('click', () => this.cancelUpload());
        this.confirmUploadBtn.addEventListener('click', () => this.confirmUpload());
        
        this.readyBtn.addEventListener('click', () => this.setReady());

        // Game screen events
        this.passBtn.addEventListener('click', () => this.selectVote('pass'));
        this.smashBtn.addEventListener('click', () => this.selectVote('smash'));
        if (this.confirmVoteBtn) this.confirmVoteBtn.addEventListener('click', () => this.confirmVote());
        if (this.nextImageBtn) this.nextImageBtn.addEventListener('click', () => this.nextImage());

        // Final results events
        this.playAgainBtn.addEventListener('click', () => this.playAgain());
        this.leaveGameBtn.addEventListener('click', () => this.leaveRoom());
    }

    setupSocketListeners() {
        this.socket.on('joined_room', (gameState) => {
            this.currentRoom = gameState.roomId;
            
            // Vérifier si ce joueur est le créateur
            const currentPlayer = gameState.players.find(p => p.name === this.playerName);
            this.isCreator = currentPlayer ? currentPlayer.isCreator : false;
            
            this.showScreen('lobby');
            this.updateLobby(gameState);
        });

        this.socket.on('player_joined', (gameState) => {
            this.updateLobby(gameState);
            this.showNotification(`${gameState.players[gameState.players.length - 1]?.name} a rejoint la room!`, 'info');
        });

        this.socket.on('player_left', ({ playerName, gameState }) => {
            this.updateLobby(gameState);
            this.showNotification(`${playerName} a quitté la room`, 'warning');
        });

        this.socket.on('image_submitted', ({ playerName }) => {
            this.showNotification(`${playerName} a envoyé une image!`, 'success');
            this.updateSubmissionStatus();
        });

        this.socket.on('player_ready_update', (gameState) => {
            this.updateReadyStatus(gameState);
        });

        this.socket.on('game_start', (gameState) => {
            this.showScreen('game');
            this.updateGameScreen(gameState);
            this.showNotification('🎮 Le jeu commence!', 'success');
        });

        this.socket.on('vote_cast', ({ playerName, votesCount, totalPlayers }) => {
            this.votingStatus.innerHTML = `<p>Vote enregistré! En attente de ${totalPlayers - votesCount} joueur(s) de plus...</p>`;
        });

        this.socket.on('vote_results', ({ image, result, votes, roomCreator }) => {
            this.showVoteResults(image, result, votes, roomCreator);
        });

        this.socket.on('next_image_start', (gameState) => {
            this.showScreen('game');
            this.updateGameScreen(gameState);
        });
        
        this.socket.on('temp_vote_registered', ({ vote }) => {
            this.currentVote = vote;
            this.updateVoteDisplay();
        });
        
        this.socket.on('vote_confirmed', () => {
            this.hasConfirmedVote = true;
            this.confirmVoteBtn.disabled = true;
            this.confirmVoteBtn.textContent = 'Vote Confirmé ✅';
            this.showNotification('Vote confirmé!', 'success');
        });
        
        this.socket.on('vote_progress', ({ confirmedCount, totalPlayers }) => {
            this.votingStatus.innerHTML = `<p>${confirmedCount}/${totalPlayers} joueurs ont confirmé leur vote</p>`;
        });

        this.socket.on('game_finished', ({ results, gameState, stats }) => {
            this.showFinalResults(results, stats);
        });

        this.socket.on('disconnect', () => {
            this.showNotification('Déconnecté du serveur', 'error');
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
            this.showNotification('Veuillez entrer votre nom!', 'error');
            return;
        }

        this.playerName = playerName;
        this.socket.emit('join_room', { roomId, playerName });
    }

    createRoom() {
        const playerName = this.playerNameInput.value.trim();
        if (!playerName) {
            this.showNotification('Veuillez entrer votre nom!', 'error');
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
        this.resetUploadForm();
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
        
        this.readyStatus.innerHTML = `${readyPlayers}/${totalPlayers} joueurs prêts`;
        
        if (readyPlayers === totalPlayers && totalPlayers > 1 && gameState.totalImages > 0) {
            this.readyStatus.innerHTML += ' - Démarrage du jeu...';
        }
    }

    handleImageSelection(event) {
        const file = event.target.files[0];
        
        if (!file) {
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Veuillez sélectionner un fichier image valide!', 'error');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.imagePreview.src = e.target.result;
            this.showPreviewStep();
        };
        reader.readAsDataURL(file);
    }

    showPreviewStep() {
        this.imageSelectionStep.style.display = 'none';
        this.imagePreviewStep.style.display = 'block';
        this.characterNameInput.focus();
    }

    cancelUpload() {
        this.imageUpload.value = '';
        this.characterNameInput.value = '';
        this.imagePreview.src = '';
        this.imageSelectionStep.style.display = 'block';
        this.imagePreviewStep.style.display = 'none';
    }

    async confirmUpload() {
        const file = this.imageUpload.files[0];
        const characterName = this.characterNameInput.value.trim();

        if (!file) {
            this.showNotification('Veuillez sélectionner une image!', 'error');
            return;
        }

        if (!characterName) {
            this.showNotification('Veuillez entrer un nom de personnage!', 'error');
            this.characterNameInput.focus();
            return;
        }

        // Disable confirm button during upload
        this.confirmUploadBtn.disabled = true;
        this.confirmUploadBtn.textContent = 'Uploading...';

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

                // Reset form and show success
                this.resetUploadForm();
                this.readyBtn.disabled = false;
                this.showNotification(`Image de ${characterName} envoyée avec succès!`, 'success');
            } else {
                this.showNotification('Erreur d\'envoi!', 'error');
            }
        } catch (error) {
            this.showNotification('Erreur d\'envoi!', 'error');
            console.error('Upload error:', error);
        } finally {
            // Re-enable confirm button
            this.confirmUploadBtn.disabled = false;
            this.confirmUploadBtn.textContent = 'Confirmer l\'Envoi';
        }
    }

    resetUploadForm() {
        if (this.imageUpload) this.imageUpload.value = '';
        if (this.characterNameInput) this.characterNameInput.value = '';
        if (this.imagePreview) this.imagePreview.src = '';
        if (this.imageSelectionStep) this.imageSelectionStep.style.display = 'block';
        if (this.imagePreviewStep) this.imagePreviewStep.style.display = 'none';
    }

    updateSubmissionStatus() {
        // This could be enhanced to show more detailed submission status
    }

    setReady() {
        this.socket.emit('player_ready', { roomId: this.currentRoom });
        this.readyBtn.disabled = true;
        this.readyBtn.textContent = 'Prêt! ✅';
        this.showNotification('Vous êtes prêt! En attente des autres joueurs...', 'info');
    }

    startTimer() {
        this.voteStartTime = Date.now();
        this.voteTimer.textContent = '0.0s';
        
        // Clear existing timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Start new timer
        this.timerInterval = setInterval(() => {
            if (this.voteStartTime) {
                const elapsed = (Date.now() - this.voteStartTime) / 1000;
                this.voteTimer.textContent = elapsed.toFixed(1) + 's';
            }
        }, 100); // Update every 100ms for smooth display
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateGameScreen(gameState) {
        this.currentRoundSpan.textContent = gameState.currentImageIndex + 1;
        this.totalRoundsSpan.textContent = gameState.totalImages;
        
        if (gameState.currentImage) {
            this.characterNameDisplay.textContent = gameState.currentImage.characterName;
            this.currentImage.src = gameState.currentImage.path;
            this.currentImage.style.display = 'block';
        }

        // Reset vote state
        this.currentVote = null;
        this.hasConfirmedVote = false;
        this.passBtn.disabled = false;
        this.smashBtn.disabled = false;
        this.passBtn.classList.remove('selected');
        this.smashBtn.classList.remove('selected');
        
        if (this.confirmVoteBtn) {
            this.confirmVoteBtn.disabled = true;
            this.confirmVoteBtn.textContent = 'Valider le Choix';
        }
        
        if (this.selectedVoteDiv) {
            this.selectedVoteDiv.innerHTML = 'Sélectionnez votre choix puis validez';
        }
        
        this.votingStatus.innerHTML = '';
        
        // Start the timer for this image
        this.startTimer();
    }

    selectVote(voteType) {
        this.currentVote = voteType;
        this.socket.emit('temp_vote', { roomId: this.currentRoom, vote: voteType });
    }
    
    updateVoteDisplay() {
        // Reset button states
        this.passBtn.classList.remove('selected');
        this.smashBtn.classList.remove('selected');
        
        // Highlight selected vote
        if (this.currentVote === 'pass') {
            this.passBtn.classList.add('selected');
            this.selectedVoteDiv.innerHTML = '❌ Vous avez sélectionné: <strong>PASS</strong>';
        } else if (this.currentVote === 'smash') {
            this.smashBtn.classList.add('selected');
            this.selectedVoteDiv.innerHTML = '💖 Vous avez sélectionné: <strong>SMASH</strong>';
        }
        
        // Enable confirm button
        if (this.confirmVoteBtn) {
            this.confirmVoteBtn.disabled = false;
            this.confirmVoteBtn.textContent = 'Valider le Choix';
        }
    }
    
    confirmVote() {
        if (!this.currentVote) return;
        
        // Stop the timer when vote is confirmed
        this.stopTimer();
        
        this.socket.emit('confirm_vote', { roomId: this.currentRoom });
    }
    
    nextImage() {
        if (this.isCreator) {
            this.socket.emit('next_image', { roomId: this.currentRoom });
        }
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

        // Affichage différent selon si le joueur est créateur ou non
        if (this.isCreator) {
            this.waitingForNext.innerHTML = '<p>Vous êtes le créateur - Cliquez sur "Au Suivant" pour continuer</p>';
            if (this.creatorControls) {
                this.creatorControls.style.display = 'block';
            }
        } else {
            this.waitingForNext.innerHTML = '<p>En attente que le créateur passe à l\'image suivante...</p>';
            if (this.creatorControls) {
                this.creatorControls.style.display = 'none';
            }
        }
    }

    showFinalResults(results, stats) {
        this.showScreen('finalResults');
        
        // Display speed statistics if available
        if (stats) {
            this.displaySpeedStats(stats);
        }
        
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

    displaySpeedStats(stats) {
        const fastestPlayerDiv = document.getElementById('fastest-player');
        const slowestPlayerDiv = document.getElementById('slowest-player');
        const detailedStatsDiv = document.getElementById('detailed-stats');
        
        // Character stats elements
        const fastestDecisionDiv = document.getElementById('fastest-decision');
        const slowestDecisionDiv = document.getElementById('slowest-decision');
        const characterStatsDiv = document.getElementById('character-stats');
        
        // Display fastest and slowest players
        if (stats.fastestPlayer) {
            const fastest = stats.fastestPlayer;
            fastestPlayerDiv.innerHTML = `
                <strong>${fastest.playerName}</strong><br>
                <small>Temps moyen: ${(fastest.averageTime / 1000).toFixed(1)}s</small>
            `;
        } else {
            fastestPlayerDiv.innerHTML = '<em>Aucune donnée</em>';
        }
        
        if (stats.slowestPlayer) {
            const slowest = stats.slowestPlayer;
            slowestPlayerDiv.innerHTML = `
                <strong>${slowest.playerName}</strong><br>
                <small>Temps moyen: ${(slowest.averageTime / 1000).toFixed(1)}s</small>
            `;
        } else {
            slowestPlayerDiv.innerHTML = '<em>Aucune donnée</em>';
        }
        
        // Display detailed stats for all players
        if (stats.allPlayers && stats.allPlayers.length > 0) {
            const detailedHTML = `
                <h4>📊 Classement Détaillé</h4>
                ${stats.allPlayers.map((player, index) => `
                    <div class="player-stat">
                        <span class="player-name">
                            ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`} 
                            ${player.playerName}
                        </span>
                        <span class="player-time">
                            ${(player.averageTime / 1000).toFixed(1)}s
                            <small>(${player.totalVotes} votes)</small>
                        </span>
                    </div>
                `).join('')}
            `;
            detailedStatsDiv.innerHTML = detailedHTML;
        } else {
            detailedStatsDiv.innerHTML = '<p><em>Pas de statistiques disponibles</em></p>';
        }
        
        // Display character/image statistics
        if (stats.imageStats) {
            this.displayCharacterStats(stats.imageStats, fastestDecisionDiv, slowestDecisionDiv, characterStatsDiv);
        }
    }
    
    displayCharacterStats(imageStats, fastestDecisionDiv, slowestDecisionDiv, characterStatsDiv) {
        // Display fastest decision
        if (imageStats.fastestDecision) {
            const fastest = imageStats.fastestDecision;
            const resultIcon = fastest.result === 'smashed' ? '💖' : '❌';
            fastestDecisionDiv.innerHTML = `
                <strong>${fastest.characterName}</strong><br>
                <small>${resultIcon} ${(fastest.averageTime / 1000).toFixed(1)}s (${fastest.result})</small>
            `;
        } else {
            fastestDecisionDiv.innerHTML = '<em>Aucune donnée</em>';
        }
        
        // Display slowest decision
        if (imageStats.slowestDecision) {
            const slowest = imageStats.slowestDecision;
            const resultIcon = slowest.result === 'smashed' ? '💖' : '❌';
            slowestDecisionDiv.innerHTML = `
                <strong>${slowest.characterName}</strong><br>
                <small>${resultIcon} ${(slowest.averageTime / 1000).toFixed(1)}s (${slowest.result})</small>
            `;
        } else {
            slowestDecisionDiv.innerHTML = '<em>Aucune donnée</em>';
        }
        
        // Display detailed character stats
        if (imageStats.allImages && imageStats.allImages.length > 0) {
            const characterHTML = `
                <h4>📊 Classement des Personnages</h4>
                ${imageStats.allImages.map((character, index) => {
                    const resultIcon = character.result === 'smashed' ? '💖' : '❌';
                    const resultColor = character.result === 'smashed' ? '#e74c3c' : '#95a5a6';
                    return `
                        <div class="player-stat">
                            <span class="player-name">
                                ${index + 1}. ${character.characterName}
                            </span>
                            <span class="player-time">
                                ${resultIcon} ${(character.averageTime / 1000).toFixed(1)}s
                                <small style="color: ${resultColor}">(${character.result})</small>
                            </span>
                        </div>
                    `;
                }).join('')}
            `;
            characterStatsDiv.innerHTML = characterHTML;
        } else {
            characterStatsDiv.innerHTML = '<p><em>Pas de statistiques de personnages disponibles</em></p>';
        }
    }

    playAgain() {
        // Reset game state and return to lobby
        this.showScreen('lobby');
        this.readyBtn.disabled = false;
        this.readyBtn.textContent = 'Je suis Prêt!';
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