const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const USER = require('./models/user.js');

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

mongoose.connect('mongodb+srv://ronitsavadimathrs:cH1EeucAIUhxPLJa@cluster0.k5wrb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(() => {
    console.log('DB success');
    server.listen(8000, () => {
        console.log('Port 8000 running');
    });
}).catch(() => {
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

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('createRoom', (username) => {
        const roomId = uuidv4();
        if (!rooms[roomId]) {
            rooms[roomId] = { players: [] };
        }

        if (isUsernameTakenInRoom(roomId, username)) {
            socket.emit('error', 'Username is already taken in this room');
            return;
        }

        // Initialize player attributes
        const player = {
            id: socket.id,
            username,
            balance: 1000,  // Default balance or fetch from DB
            cards: [],  // Initialize with an empty array
            // Add any additional attributes you need here
        };

        rooms[roomId].players.push(player);
        usernames[socket.id] = username;

        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        updatePlayerList(roomId);
        console.log(`Room created with ID: ${roomId} by ${username}`);
    });

    socket.on('joinRoom', (roomId, username) => {
        if (!rooms[roomId]) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (isUsernameTakenInRoom(roomId, username)) {
            socket.emit('error', 'Username is already taken in this room');
            return;
        }

        // Initialize player attributes
        const player = {
            id: socket.id,
            username,
            balance: 1000,  // Default balance or fetch from DB
            cards: [],  // Initialize with an empty array
            // Add any additional attributes you need here
        };

        rooms[roomId].players.push(player);
        usernames[socket.id] = username;

        socket.join(roomId);
        socket.emit('joinedRoom', roomId);
        io.to(roomId).emit('playerJoined', username);
        updatePlayerList(roomId);
        console.log(`${username} joined room: ${roomId}`);
    });

    socket.on('leaveRoom', (roomId) => {
        const username = usernames[socket.id];
        if (rooms[roomId]) {
            const index = rooms[roomId].players.findIndex(player => player.id === socket.id);
            if (index !== -1) {
                rooms[roomId].players.splice(index, 1);
                socket.leave(roomId);

                io.to(roomId).emit('playerLeft', username);
                updatePlayerList(roomId);

                if (rooms[roomId].players.length === 0) {
                    delete rooms[roomId];
                }

                console.log(`${username} left room: ${roomId}`);
            }
        }
    });

    socket.on('disconnect', () => {
        const username = usernames[socket.id];
        delete usernames[socket.id];

        for (const roomId in rooms) {
            const index = rooms[roomId].players.findIndex(player => player.id === socket.id);
            if (index !== -1) {
                rooms[roomId].players.splice(index, 1);
                io.to(roomId).emit('playerLeft', username);
                updatePlayerList(roomId);

                if (rooms[roomId].players.length === 0) {
                    delete rooms[roomId];
                }

                console.log(`${username} disconnected and left room: ${roomId}`);
            }
        }
    });

    function isUsernameTakenInRoom(roomId, username) {
        return rooms[roomId] && rooms[roomId].players.some(player => player.username === username);
    }

    function updatePlayerList(roomId) {
        if (rooms[roomId]) {
            const playerDetails = rooms[roomId].players.map(player => ({
                username: player.username,
                balance: player.balance,
                cards: player.cards,
                // Include any additional attributes here
            }));
            io.to(roomId).emit('updatePlayerList', playerDetails);
        }
    }
});
