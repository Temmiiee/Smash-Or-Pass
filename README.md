# 🔥 Smash or Pass - Multiplayer Game

A fun multiplayer web-based "Smash or Pass" voting game where players can upload images and vote on them in real-time.

## 🎮 How to Play

1. **Join or Create a Room**: Enter your name and either join an existing room with a room ID or create a new random room
2. **Submit Images**: Upload any image and give it a character/thing name 
3. **Get Ready**: Once you've uploaded your images, click "I'm Ready!"
4. **Vote**: When all players are ready, the voting begins! Vote "Smash" 💖 or "Pass" ❌ on each image
5. **See Results**: After each vote, see the results and which players voted what
6. **Final Results**: At the end, see a summary of all the smashed and passed images

## 🚀 Features

- **Real-time Multiplayer**: Multiple players can join the same room simultaneously
- **Image Upload**: Players can upload and name their submissions
- **Live Voting**: Real-time voting with instant result display
- **Ready System**: All players must be ready before the game starts
- **Results Tracking**: See individual votes and final outcomes
- **Responsive Design**: Works on desktop and mobile devices
- **Room Management**: Easy room creation and joining system

## 🛠️ Installation & Setup

1. **Clone or Download**: Get the project files
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Server**:
   ```bash
   npm start
   ```
4. **Open in Browser**: Go to `http://localhost:3000`

## 🏗️ Technology Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **File Upload**: Multer for image handling
- **Real-time Communication**: WebSockets via Socket.io

## 📁 Project Structure

```
smash-or-pass-game/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── public/                # Frontend files
│   ├── index.html         # Main HTML file
│   ├── css/
│   │   └── style.css      # Styling
│   └── js/
│       └── client.js      # Client-side JavaScript
└── uploads/               # Uploaded images storage
```

## 🎯 Game Flow

1. **Welcome Screen**: Enter name and room details
2. **Lobby**: See other players, upload images, mark as ready
3. **Voting Phase**: Vote on each image one by one
4. **Results**: See vote breakdown after each image
5. **Final Results**: Complete summary at the end
6. **Play Again**: Option to restart in the same room

## 🌐 Multiplayer Features

- Multiple players can join the same room
- Real-time synchronization of all game states
- Live player list showing who's ready
- Instant notification of player actions
- Automatic room cleanup when empty

## 🔧 Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## 📱 Mobile Support

The game is fully responsive and works great on:
- Desktop browsers
- Tablets
- Mobile phones

## 🎨 Customization

The game can be easily customized:
- Modify `style.css` for different themes
- Adjust vote timing in `server.js`
- Change UI text in `index.html`
- Add sound effects or animations in `client.js`

---

### 🎊 Have Fun!

Enjoy playing Smash or Pass with your friends! The game supports any number of players and is perfect for parties, group calls, or just hanging out online.