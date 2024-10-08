const socket = io();
function $(id){ return document.getElementById(id); }

const createRoomBtn = $('createRoom');
const joinRoomBtn = $('joinRoom');
const usernameInput = $('usernameInput');
const roomIdInput = $('roomIdInput');
const lobbyDiv = $('lobby');
const gameRoomDiv = $('gameRoom');
const roomTitle = $('roomTitle');
const playersList = $('playersList');
const leaveRoomBtn = $('leaveRoom');
const playersActionsList = $('playersActionsList');

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
        alert('Select a bet amount')
    }
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

socket.on('lessPlayersError', ()=>{
    alert('Two or more players are required before starting game.')
})

socket.on('gameAlreadyStartedError', ()=>{
    alert('This game is already started.')
})

// Existing code...
socket.on('gameStarted', (roomData) => {
    // Show the game actions section
    document.getElementById('gameActions').style.display = 'block';
    updatePlayerActionsList(roomData.players);
});

// Function to update players' actions list
function updatePlayerActionsList(players) {
    playersActionsList.innerHTML = '';
    Object.values(players).forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.innerHTML = `
            <strong>${player.username}</strong>: 
            Cards: ${JSON.stringify(player.cards_in_hand)}, 
            Sum: ${player.cards_sum} 
            <button onclick="hit('${player.id}')">Hit</button>
            <button onclick="stand('${player.id}')">Stand</button>
        `;
        playersActionsList.appendChild(playerDiv);
    });
}

// Function to handle Hit action
function hit(playerId) {
    console.log(`Hit requested for player: ${playerId}`); // Debugging
    socket.emit('hit', currentRoomId, playerId);
}

function stand(playerId) {
    console.log(`Stand requested for player: ${playerId}`); // Debugging
    socket.emit('stand', currentRoomId, playerId);
}

socket.on('playerHit', (playerId, newCard, cardsSum, players) => {
    console.log(`${playerId} hit and received ${JSON.stringify(newCard)}. New sum: ${cardsSum}`);
    // Use the players data received from the server
    updatePlayerActionsList(players);
});

socket.on('playerStood', (playerId, players) => {
    console.log(`${playerId} stood.`);
    // Use the players data received from the server
    updatePlayerActionsList(players);
});
