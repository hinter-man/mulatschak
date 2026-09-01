'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: createClient } = require('socket.io-client');
const createGameServer = require('../server').createGameServer;

function emitWithAck(socket, event, data) {
    return new Promise(resolve => {
        if (data === undefined) {
            socket.emit(event, resolve);
        } else {
            socket.emit(event, data, resolve);
        }
    });
}

function connect(url) {
    return new Promise((resolve, reject) => {
        const socket = createClient(url + '/room', {
            forceNew: true,
            transports: ['websocket']
        });
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
    });
}

function connectLobby(url) {
    return new Promise((resolve, reject) => {
        const socket = createClient(url + '/lobby', {
            forceNew: true,
            transports: ['websocket']
        });
        socket.once('update-room-list', rooms => resolve({ socket: socket, rooms: rooms }));
        socket.once('connect_error', reject);
    });
}

test('rejects invalid rooms without crashing the server', async t => {
    const gameServer = createGameServer();
    const address = await gameServer.start(0);
    const url = 'http://127.0.0.1:' + address.port;
    const socket = await connect(url);
    t.after(async () => {
        socket.disconnect();
        await gameServer.stop();
    });

    const result = await emitWithAck(socket, 'join-room', {
        roomId: 999,
        username: 'Player'
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /does not exist/);
    assert.equal(gameServer.server.listening, true);
});

test('derives player identity from the socket and enforces bidding turns', async t => {
    const gameServer = createGameServer();
    const address = await gameServer.start(0);
    const url = 'http://127.0.0.1:' + address.port;
    const sockets = [];
    t.after(async () => {
        sockets.forEach(socket => socket.disconnect());
        await gameServer.stop();
    });

    for (let index = 0; index < 4; index++) {
        const socket = await connect(url);
        sockets.push(socket);
        const joined = await emitWithAck(socket, 'join-room', {
            roomId: 0,
            username: 'Player ' + index
        });
        assert.equal(joined.ok, true);
    }

    for (const socket of sockets) {
        const ready = await emitWithAck(socket, 'set-ready');
        assert.equal(ready.ok, true);
    }

    const room = gameServer.rooms[0];
    const firstBidder = room.players.find(player => player.order === 1);
    const wrongSocket = sockets.find(socket => socket.id !== firstBidder.socketId);
    const rejectedBid = await emitWithAck(wrongSocket, 'set-trick-call', 6);

    assert.equal(rejectedBid.ok, false);
    assert.match(rejectedBid.error, /not your turn/);
    assert.equal(room.players.every(player => player.trickCall === 0), true);

    const firstSocket = sockets.find(socket => socket.id === firstBidder.socketId);
    const acceptedBid = await emitWithAck(firstSocket, 'set-trick-call', 2);
    assert.equal(acceptedBid.ok, true);
    assert.equal(firstBidder.trickCall, 2);
});

test('only the winning bidder can choose trump', async t => {
    const gameServer = createGameServer();
    const address = await gameServer.start(0);
    const url = 'http://127.0.0.1:' + address.port;
    const socket = await connect(url);
    t.after(async () => {
        socket.disconnect();
        await gameServer.stop();
    });

    await emitWithAck(socket, 'join-room', { roomId: 0, username: 'Player' });
    const result = await emitWithAck(socket, 'set-trump', 'herz');

    assert.equal(result.ok, false);
    assert.match(result.error, /cannot choose trump/);
    assert.equal(gameServer.rooms[0].trump, '');
});

test('lobby data does not expose players, hands, or decks', async t => {
    const gameServer = createGameServer();
    const address = await gameServer.start(0);
    const url = 'http://127.0.0.1:' + address.port;
    const lobbyConnection = await connectLobby(url);
    t.after(async () => {
        lobbyConnection.socket.disconnect();
        await gameServer.stop();
    });

    assert.deepEqual(Object.keys(lobbyConnection.rooms[0]).sort(), [
        'amountOfPlayers',
        'availableSeats',
        'id',
        'name'
    ]);
});
