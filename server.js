const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const USER = require('./models/user.js');
const Deck = require('./public/algorithm_drawCards.js');

const app = express();
app.use(bodyParser.json());
const server = http.createServer(app);
const io = new Server(server);

app.use(cors({
    origin: '*',
}));
app.use(express.static('public'));
app.use(express.json());

let rooms = {};
let usernames = {};

mongoose.connect('mongodb+srv://ronitsavadimathrs:cH1EeucAIUhxPLJa@cluster0.k5wrb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => {
        console.log('DB success');
        server.listen(8000, () => {
            console.log('Port 8000 running');
        });
    })
    .catch(() => {
        console.log('Failed');
    });

app.post('/api/login', async (req, res) => {
    try {
        const { username, balance } = req.body;
        const findUser = await USER.findOne({ username });

        if (findUser) {
            return res.status(400).json({ error: "User already exists" });
        }

        const user = await USER.create({ username, balance });
        res.status(200).json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/getallusers', async (req, res) => {
    try {
        const users = await USER.find({});
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('createRoom', (username, balance = 1000) => {
        const roomId = uuidv4();
        let deck = new Deck();

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: {},
                card_deck: deck.cards,
                pot_amount: 0,
                bet_size: 50,
                can_join: true,
                player_count: 1,
                is_playing: false,
            };
        }

        if (isUsernameTakenInRoom(roomId, username)) {
            socket.emit('usernameTakenError', 'Username is already taken in this room');
            return;
        }

        usernames[socket.id] = {
            username,
            balance,
            cards_in_hand: [],
            cards_sum: 0,
            is_out: false,
            is_stand: false,
            is_chance: true,
        };

        rooms[roomId].players[socket.id] = {
            id: socket.id,
            username,
            ...usernames[socket.id],
        };

        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        updatePlayerList(roomId); 

        console.log(`Room created with ID: ${roomId} by ${username}`);
        console.log('Current rooms:', JSON.stringify(rooms, null, 2));
    });

    socket.on('joinRoom', (roomId, username) => {
        if (!rooms[roomId]) {
            socket.emit('roomNotFoundError', 'Room not found');
            return;
        }

        if (isUsernameTakenInRoom(roomId, username)) {
            socket.emit('userExistsError', 'Username is already taken in this room');
            return;
        }

        if(!rooms[roomId].can_join){
        
            console.log('Match has already started');
            socket.emit('matchStartedError', 'Match started');
            return;
        }

        if(rooms[roomId].player_count >= 4){
            console.log('Lobby is full. Cannot join.')
            socket.emit('lobbyFullError', ()=>{
                console.log('Lobby is full. Cannot join.')
            });
            return;
        }

        

        rooms[roomId].players[socket.id] = {
            id: socket.id,
            username,
            balance: 1000,
            cards_in_hand: [],
            cards_sum: 0,
            is_out: false,
            is_stand: false,
            is_chance: false,
        };

        rooms[roomId].player_count++;

        socket.join(roomId);
        socket.emit('joinedRoom', roomId);
        io.to(roomId).emit('playerJoined', username);
        updatePlayerList(roomId); 
        console.log(`${username} joined room: ${roomId}`);
        console.log('Current rooms:', JSON.stringify(rooms, null, 2));
    });

    socket.on('leaveRoom', (roomId) => {
        const username = usernames[socket.id]?.username;
        if (rooms[roomId]) {
            delete rooms[roomId].players[socket.id];
            rooms[roomId].player_count--; 
            socket.leave(roomId); 

            io.to(roomId).emit('playerLeft', username);
            updatePlayerList(roomId);

            if (Object.keys(rooms[roomId].players).length === 0) {
                delete rooms[roomId];
            }

            console.log(`${username} left room: ${roomId}`);
        }
    });

    socket.on('disconnect', () => {
        const username = usernames[socket.id]?.username;
        delete usernames[socket.id];

        for (const roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                rooms[roomId].player_count--;
                io.to(roomId).emit('playerLeft', username);
                updatePlayerList(roomId);

                if (Object.keys(rooms[roomId].players).length === 0) {
                    delete rooms[roomId]; 
                }

                console.log(`${username} disconnected and left room: ${roomId}`);
            }
        }
    });


    socket.on('updateBetSize', (roomId, betSize) => {
        if (rooms[roomId]) {
            rooms[roomId].bet_size = betSize;
            io.to(roomId).emit('betSizeUpdated', betSize);
            console.log(`Bet size updated to $${betSize} in room ${roomId}`);
        }
    });


    socket.on('betSizeChanged', (roomId, betSize) => {
        if (rooms[roomId]) {
            rooms[roomId].bet_size = betSize;
            io.to(roomId).emit('betSizeUpdated', betSize); 
            console.log(`Bet size updated to $${betSize} in room ${roomId}`);
        }
    });
    

    socket.on('startGame', (roomId) => {

        if (rooms[roomId]) {
            if (rooms[roomId].player_count <= 1) {
                socket.emit('lessPlayersError', 'Two or more players required to start the game');
                return;
            }
    
            rooms[roomId].can_join = false;
            rooms[roomId].pot_amount = rooms[roomId].bet_size * rooms[roomId].player_count;
    
            let deck = createDeck();
            shuffleDeck(deck);
    
            Object.values(rooms[roomId].players).forEach(player => {
                if (player.balance >= rooms[roomId].bet_size) {
                    player.balance -= rooms[roomId].bet_size;
    
                    player.cards_in_hand = drawCards(deck, 2);
                    player.cards_sum = calculateCardSum(player.cards_in_hand);
    
                    console.log(`Player ${player.username} has cards:`, player.cards_in_hand);
                    console.log(`Sum of cards: ${player.cards_sum}`);
                } else {
                    console.log(`Player ${player.username} does not have enough balance to place the bet.`);
                    socket.emit('insufficientBalanceError', player.username);
                }
            });
    
            io.to(roomId).emit('gameStarted', rooms[roomId]);
    
            console.log(`Game started in room: ${roomId}`);
            console.log('Current rooms:', JSON.stringify(rooms, null, 2));
        } else {
            console.log(`Room ${roomId} not found`);
        }
    });
    
    function createDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let deck = [];
    
        for (let suit of suits) {
            for (let value of values) {
                deck.push({ suit, value });
            }
        }
        return deck;
    }
    
    //Fisher-Yates shuffle algorithn
    function shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }
    
    function drawCards(deck, n) {
        let drawnCards = [];
        for (let i = 0; i < n; i++) {
            drawnCards.push(deck.pop());
        }
        return drawnCards;
    }
    
    function calculateCardSum(cards) {
        let sum = 0;
        let aceCount = 0;
    
        cards.forEach(card => {
            if (card.value === 'A') {
                aceCount += 1;
                sum += 11; // Initially treat Ace as 11
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                sum += 10; // Face cards are worth 10
            } else {
                sum += parseInt(card.value, 10); // Numeric cards are their face value
            }
        });
    
        // If the sum exceeds 21 and we have Aces, treat them as 1 instead of 11
        while (sum > 21 && aceCount > 0) {
            sum -= 10; // Change an Ace from 11 to 1
            aceCount -= 1;
        }
    
        return sum;
    }
    

    function isUsernameTakenInRoom(roomId, username) {
        if (rooms[roomId] && typeof rooms[roomId].players === 'object') {
            return Object.values(rooms[roomId].players).some(player => player.username === username);
        }
        return false;
    }

    function updatePlayerList(roomId) {
        if (rooms[roomId]) {
            const playerUsernames = Object.values(rooms[roomId].players).map(player => player.username);
            io.to(roomId).emit('updatePlayerList', playerUsernames);
        }
    }


    socket.on('hit', (roomId, playerId) => {
        console.log(`Hit event received for player: ${playerId} in room: ${roomId}`); // Debugging

        const room = rooms[roomId];
        if (room && room.players[playerId]) {
            const player = room.players[playerId];
            const newCard = room.card_deck.pop(); // Draw a new card from the deck
            player.cards_in_hand.push(newCard);
            player.cards_sum = calculateCardSum(player.cards_in_hand);
    
            io.to(roomId).emit('playerHit', playerId, newCard, player.cards_sum);
            updatePlayerList(roomId); // Update player list to show new cards
        }
    });
    
    socket.on('stand', (roomId, playerId) => {
        console.log(`Stand event received for player: ${playerId} in room: ${roomId}`); // Debugging

        const room = rooms[roomId];
        if (room && room.players[playerId]) {
            const player = room.players[playerId];
            player.is_stand = true; // Mark player as standing
            io.to(roomId).emit('playerStood', playerId);
            checkGameStatus(roomId); // Check if the game can continue
        }
    });
    
    // Function to check the game status
    function checkGameStatus(roomId) {
        const room = rooms[roomId];
        const allPlayersStood = Object.values(room.players).every(player => player.is_stand || player.is_out);
    
        if (allPlayersStood) {
            // Determine winner and end game logic
            const winner = determineWinner(room.players);
            io.to(roomId).emit('gameEnded', winner);
            // Reset or cleanup the room as needed
        }
    }
    
    // Function to determine winner based on the players' sums
    function determineWinner(players) {
        // Implement your game logic here to determine the winner
        // Return the winning player's username or details
    }
    

});
