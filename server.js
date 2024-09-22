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
            is_chance: false
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
            rooms[roomId].can_join = false;
            rooms[roomId].pot_amount = rooms[roomId].bet_size * rooms[roomId].player_count;
            console.log(`Game started in room: ${roomId}`);
            console.log('Current rooms:', JSON.stringify(rooms, null, 2));
        } else {
            console.log(`Room ${roomId} not found`);
        }
    });
    

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
});
