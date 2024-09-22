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

let currentRoomId = null;

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

document.querySelectorAll('input[name="betAmount"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        const selectedBet = document.querySelector('input[name="betAmount"]:checked');
        let roomid = roomTitle.innerText;
        if (selectedBet) {
            const betAmount = parseInt(selectedBet.value, 10);
            socket.emit('betSizeChanged', roomid, betAmount);
        }
    });
});





document.getElementById('startGameButton').addEventListener('click', () => {
    console.log('Start Game button clicked'); 
    const selectedBet = document.querySelector('input[name="betAmount"]:checked');
    let roomid= roomTitle.innerText;
    if (selectedBet) {
        const betAmount = parseInt(selectedBet.value, 10);
        console.log(`Bet amount selected: $${betAmount}`);
        socket.emit('updateBetSize', roomid, betAmount);
        socket.emit('startGame', roomid);
    } else {
        console.log('Please select a bet amount before starting the game.');
    }
});



socket.on('roomCreated', (roomId) => {
    currentRoomId = roomId;
    roomTitle.textContent = roomId;
    lobbyDiv.style.display = 'none';
    gameRoomDiv.style.display = 'block';
});


socket.on('joinedRoom', (roomId) => {
    currentRoomId = roomId;
    roomTitle.textContent = roomId;
    lobbyDiv.style.display = 'none';
    gameRoomDiv.style.display = 'block';
});


socket.on('updatePlayerList', (players) => {
    playersList.innerHTML = '';
    players.forEach(username => {
        const playerItem = document.createElement('div');
        playerItem.textContent = `Player: ${username}`;
        playersList.appendChild(playerItem);
    });
});


leaveRoomBtn.addEventListener('click', () => {
    if (currentRoomId) {
        socket.emit('leaveRoom', currentRoomId);

        lobbyDiv.style.display = 'block';
        gameRoomDiv.style.display = 'none';
        playersList.innerHTML = '';
        currentRoomId = null;
    }
});

socket.on('betSizeUpdated', (betSize) => {

    const betOptions = document.querySelectorAll('input[name="betAmount"]');
    betOptions.forEach((option) => {
        if (parseInt(option.value, 10) === betSize) {
            option.checked = true; 
        }
    });
});



socket.on('playerLeft', (username) => {
    const playerItems = playersList.querySelectorAll('div');
    playerItems.forEach(item => {
        if (item.textContent.includes(username)) {
            item.remove();
        }
    });
});

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
});

socket.on('matchStartedError', ()=>{
    alert('Match already started.')
})

