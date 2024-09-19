const socket = io();

const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const usernameInput = document.getElementById('usernameInput');
const roomIdInput = document.getElementById('roomIdInput');
const lobbyDiv = document.getElementById('lobby');
const gameRoomDiv = document.getElementById('gameRoom');
const roomTitle = document.getElementById('roomTitle');
const playersList = document.getElementById('playersList');
const leaveRoomBtn = document.getElementById('leaveRoom');

let currentRoomId = null;  // Store the current room ID

// Create room
createRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        socket.emit('createRoom', username);
    }
});

// Join room
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    const username = usernameInput.value.trim();
    if (roomId && username) {
        socket.emit('joinRoom', roomId, username);
    }
});

// When room is created, switch to game room view
socket.on('roomCreated', (roomId) => {
    currentRoomId = roomId;
    roomTitle.textContent = `Room ID: ${roomId}`;
    lobbyDiv.style.display = 'none';
    gameRoomDiv.style.display = 'block';
});

// When successfully joined a room
socket.on('joinedRoom', (roomId) => {
    currentRoomId = roomId;
    roomTitle.textContent = `Room ID: ${roomId}`;
    lobbyDiv.style.display = 'none';
    gameRoomDiv.style.display = 'block';
});

// Update player list when the player list changes
socket.on('updatePlayerList', (players) => {
    playersList.innerHTML = '';  // Clear the list before updating
    players.forEach(username => {
        const playerItem = document.createElement('div');
        playerItem.textContent = `Player: ${username}`;
        playersList.appendChild(playerItem);
    });
});

// Leave room button
leaveRoomBtn.addEventListener('click', () => {
    if (currentRoomId) {
        socket.emit('leaveRoom', currentRoomId);

        // Return to lobby view
        lobbyDiv.style.display = 'block';
        gameRoomDiv.style.display = 'none';
        playersList.innerHTML = '';  // Clear player list
        currentRoomId = null;
    }
});

// Handle player leaving
socket.on('playerLeft', (username) => {
    const playerItems = playersList.querySelectorAll('div');
    playerItems.forEach(item => {
        if (item.textContent.includes(username)) {
            item.remove();
        }
    });
});

// Display error messages
socket.on('error', (message) => {
    alert(message);
});
