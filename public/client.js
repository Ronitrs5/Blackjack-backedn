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


document.getElementById('startGameButton').addEventListener('click', () => {
    console.log('Start Game button clicked'); // Check if this logs
    const selectedBet = document.querySelector('input[name="betAmount"]:checked');
    let roomid= roomTitle.innerText;
    if (selectedBet) {
        const betAmount = parseInt(selectedBet.value, 10);
        console.log(`Bet amount selected: $${betAmount}`); // Log the selected bet
        socket.emit('updateBetSize', roomid, betAmount);
        socket.emit('startGame', roomid);
    } else {
        console.log('Please select a bet amount before starting the game.');
    }
});



// When room is created, switch to game room view
socket.on('roomCreated', (roomId) => {
    currentRoomId = roomId;
    roomTitle.textContent = roomId;
    lobbyDiv.style.display = 'none';
    gameRoomDiv.style.display = 'block';
});

// When successfully joined a room
socket.on('joinedRoom', (roomId) => {
    currentRoomId = roomId;
    roomTitle.textContent = roomId;
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
socket.on('roomNotFoundError', (message) => {
    alert(message);
});


socket.on('lobbyFullError', ()=>{
    alert('Cannot join lobby. Lobby is full.');
})

socket.on('userExistsError', ()=>{
    alert('Username already exists in the lobby');
})

socket.on('betSizeUpdated', (betSize) => {
    console.log(`The bet size has been updated to $${betSize}.`);
    // You can also update the UI to reflect this change if needed
});

socket.on('matchStartedError', ()=>{
    alert('Match already started.')
})

