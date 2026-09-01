const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Room = require('./Room').Room;
const game = require('./Deck');

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const VALID_TRUMPS = new Set(['herz', 'eichel', 'pik', 'schelle']);
const VALID_TRICK_CALLS = new Set([0, 2, 3, 4, 5, 6]);

function createGameServer() {
    const app = express();
    app.use(express.static(path.join(__dirname, 'public')));

    const server = http.createServer(app);
    const io = new Server(server);
    const lobby = io.of('/lobby');
    const roomNamespace = io.of('/room');
    const rooms = [new Room(0, 'Testroom')];

    function publicPlayer(currentPlayer) {
        return {
            name: currentPlayer.name,
            order: currentPlayer.order,
            points: currentPlayer.points,
            ready: currentPlayer.ready,
            trickCall: currentPlayer.trickCall,
            trickCalls: currentPlayer.trickCalls
        };
    }

    function privatePlayer(currentPlayer) {
        return Object.assign(publicPlayer(currentPlayer), {
            hand: currentPlayer.hand
        });
    }

    function publicRoom(room) {
        return {
            id: room.id,
            name: room.name,
            amountOfPlayers: room.amountOfPlayers,
            availableSeats: room.availableSeats,
            phase: room.phase,
            players: room.players.map(publicPlayer),
            round: room.round,
            trump: room.trump,
            turnNo: room.turnNo
        };
    }

    function lobbyRoom(room) {
        return {
            id: room.id,
            name: room.name,
            amountOfPlayers: room.amountOfPlayers,
            availableSeats: room.availableSeats
        };
    }

    function sendRoomList(socket) {
        socket.emit('update-room-list', rooms.map(lobbyRoom));
    }

    function broadcastRoomList() {
        lobby.emit('update-room-list', rooms.map(lobbyRoom));
    }

    function emitRoom(room, event, data) {
        roomNamespace.to(String(room.id)).emit(event, data);
    }

    function updateRoomPlayersList(room) {
        emitRoom(room, 'update-player-list', publicRoom(room));
    }

    function updatePlayersPointsList(room) {
        emitRoom(room, 'update-points', publicRoom(room));
    }

    function broadcastTrickCalls(room) {
        emitRoom(room, 'player-trick-calls', room.players.map(publicPlayer));
    }

    function displayTrump(room) {
        emitRoom(room, 'display-trump', room.trump);
    }

    function rejectEvent(socket, event, message, acknowledge) {
        socket.emit('game-error', { event: event, message: message });
        if (typeof acknowledge === 'function') {
            acknowledge({ ok: false, error: message });
        }
    }

    function acceptEvent(acknowledge, data) {
        if (typeof acknowledge === 'function') {
            acknowledge(Object.assign({ ok: true }, data));
        }
    }

    function getSocketRoom(socket) {
        const roomId = socket.data.roomId;
        if (!Number.isInteger(roomId)) {
            return undefined;
        }
        return rooms[roomId];
    }

    function getSocketPlayer(socket, room) {
        return room && room.getPlayer(socket.id);
    }

    function startRound(room) {
        room.round++;
        room.deck = game.createDeck();
        room.trump = '';
        room.phase = 'bidding';
        room.biddingTurnNo = 1;
        room.winningBidderSocketId = null;
        room.turnNo = 0;

        if (room.round === 1) {
            room.setRandomOrder();
            room.players.sort(compareByOrder);
        }

        emitRoom(room, 'enable-trick-button');
        displayTrump(room);
        updatePlayersPointsList(room);

        room.players.forEach(currentPlayer => {
            const playerSocket = roomNamespace.sockets.get(currentPlayer.socketId);
            currentPlayer.hand = game.draw(room.deck, 5, currentPlayer.hand);
            if (playerSocket) {
                playerSocket.emit('start-round', privatePlayer(currentPlayer));
            }
        });
    }

    function finishTrick(room) {
        const winningPlayer = game.getPlayerIdxWithHighestCard(room.playedCards, room.trump);
        winningPlayer.trickCalls++;
        room.turnNo = winningPlayer.order;
        updateRoomPlayersList(room);

        const roundComplete = room.players.every(currentPlayer => currentPlayer.hand.length === 0);
        room.playedCards.clear();
        broadcastTrickCalls(room);

        setTimeout(() => {
            emitRoom(room, 'update-played-cards', undefined);
        }, 1500);

        if (!roundComplete) {
            return;
        }

        room.players.forEach(currentPlayer => currentPlayer.registerPoints(room.trump));
        updatePlayersPointsList(room);

        if (room.isGameOver()) {
            emitRoom(room, 'game-over');
            room.resetGameData();
            return;
        }

        startRound(room);
    }

    function registerPlayedCard(socket, room, currentPlayer, cardId, acknowledge) {
        if (room.phase !== 'playing') {
            rejectEvent(socket, 'play-card', 'Cards can only be played during a trick.', acknowledge);
            return;
        }
        if (room.turnNo !== currentPlayer.order) {
            rejectEvent(socket, 'play-card', 'It is not your turn.', acknowledge);
            return;
        }
        if (typeof cardId !== 'string') {
            rejectEvent(socket, 'play-card', 'Invalid card.', acknowledge);
            return;
        }

        const actualCard = currentPlayer.hand.find(card => card.id === cardId);
        if (!actualCard) {
            rejectEvent(socket, 'play-card', 'The selected card is not in your hand.', acknowledge);
            return;
        }

        const playedCards = Array.from(room.playedCards.values());
        if (playedCards.length > 0 &&
            !game.checkPlayedCardFromPlayer(playedCards, actualCard, currentPlayer.hand, room.trump)) {
            rejectEvent(socket, 'play-card', 'The selected card does not follow the game rules.', acknowledge);
            return;
        }

        room.playedCards.set(currentPlayer, actualCard);
        room.setTurnNo();
        currentPlayer.removeCardFromHand(cardId);

        updateRoomPlayersList(room);
        socket.emit('update-cards', privatePlayer(currentPlayer));
        emitRoom(room, 'update-played-cards', actualCard);
        acceptEvent(acknowledge);

        if (room.playedCards.size === room.amountOfPlayers) {
            finishTrick(room);
        }
    }

    function removeSocketPlayer(socket) {
        const room = getSocketRoom(socket);
        if (!room) {
            return;
        }

        const gameWasActive = room.phase !== 'waiting';
        room.removePlayer(socket.id);
        delete socket.data.roomId;

        if (gameWasActive) {
            room.resetGameData();
            emitRoom(room, 'game-aborted', 'A player disconnected. The game was reset.');
            displayTrump(room);
            broadcastTrickCalls(room);
            updatePlayersPointsList(room);
        }

        broadcastRoomList();
        updateRoomPlayersList(room);
    }

    lobby.on('connection', socket => {
        sendRoomList(socket);

        socket.on('add-room', (name, acknowledge) => {
            const roomName = typeof name === 'string' ? name.trim() : '';
            if (roomName.length < 1 || roomName.length > 50) {
                rejectEvent(socket, 'add-room', 'Room names must contain 1 to 50 characters.', acknowledge);
                return;
            }

            rooms.push(new Room(rooms.length, roomName));
            broadcastRoomList();
            acceptEvent(acknowledge, { roomId: rooms.length - 1 });
        });
    });

    roomNamespace.on('connection', socket => {
        socket.on('join-room', (data, acknowledge) => {
            if (!data || typeof data !== 'object') {
                rejectEvent(socket, 'join-room', 'Invalid join request.', acknowledge);
                return;
            }
            if (Number.isInteger(socket.data.roomId)) {
                rejectEvent(socket, 'join-room', 'This connection already joined a room.', acknowledge);
                return;
            }

            const roomId = Number(data.roomId);
            const username = typeof data.username === 'string' ? data.username.trim() : '';
            const selectedRoom = Number.isInteger(roomId) ? rooms[roomId] : undefined;
            if (!selectedRoom) {
                rejectEvent(socket, 'join-room', 'The selected room does not exist.', acknowledge);
                return;
            }
            if (username.length < 1 || username.length > 30) {
                rejectEvent(socket, 'join-room', 'Usernames must contain 1 to 30 characters.', acknowledge);
                return;
            }
            if (!selectedRoom.addPlayer(socket.id, roomId, username)) {
                rejectEvent(socket, 'join-room', 'The selected room is full.', acknowledge);
                return;
            }

            socket.data.roomId = roomId;
            socket.join(String(roomId));
            socket.emit('room-data', {
                id: selectedRoom.id,
                name: selectedRoom.name
            });
            updateRoomPlayersList(selectedRoom);
            broadcastRoomList();
            acceptEvent(acknowledge);
        });

        socket.on('disconnect', () => {
            removeSocketPlayer(socket);
        });

        socket.on('set-ready', acknowledge => {
            const selectedRoom = getSocketRoom(socket);
            const currentPlayer = getSocketPlayer(socket, selectedRoom);
            if (!currentPlayer || selectedRoom.phase !== 'waiting') {
                rejectEvent(socket, 'set-ready', 'You cannot become ready right now.', acknowledge);
                return;
            }

            const everyoneReady = selectedRoom.setPlayerReady(socket.id);
            updateRoomPlayersList(selectedRoom);
            acceptEvent(acknowledge);
            if (everyoneReady) {
                startRound(selectedRoom);
            }
        });

        socket.on('set-trick-call', (trickCall, acknowledge) => {
            const selectedRoom = getSocketRoom(socket);
            const currentPlayer = getSocketPlayer(socket, selectedRoom);
            const numericCall = Number(trickCall);
            if (!currentPlayer || selectedRoom.phase !== 'bidding' ||
                currentPlayer.order !== selectedRoom.biddingTurnNo) {
                rejectEvent(socket, 'set-trick-call', 'It is not your turn to bid.', acknowledge);
                return;
            }
            if (!VALID_TRICK_CALLS.has(numericCall)) {
                rejectEvent(socket, 'set-trick-call', 'Invalid trick call.', acknowledge);
                return;
            }

            const highestCall = Math.max(0, ...selectedRoom.players.map(player => player.trickCall));
            if ((numericCall > 0 && numericCall <= highestCall) ||
                (currentPlayer.order === selectedRoom.amountOfPlayers && highestCall === 0 && numericCall === 0)) {
                rejectEvent(socket, 'set-trick-call', 'The trick call must exceed the current bid.', acknowledge);
                return;
            }

            selectedRoom.setTrickCall(socket.id, numericCall);
            if (numericCall > 0) {
                emitRoom(selectedRoom, 'disable-trick-button', numericCall);
            }

            selectedRoom.biddingTurnNo++;
            const nextPlayer = selectedRoom.players.find(
                player => player.order === selectedRoom.biddingTurnNo
            );
            if (nextPlayer) {
                const nextSocket = roomNamespace.sockets.get(nextPlayer.socketId);
                if (nextSocket) {
                    if (nextPlayer.order === selectedRoom.amountOfPlayers &&
                        selectedRoom.players.every(player => player.trickCall === 0)) {
                        nextSocket.emit('disable-trick-button', 0);
                    }
                    nextSocket.emit('show-trick-modal', privatePlayer(nextPlayer));
                }
            } else {
                const winningSocketId = selectedRoom.getSocketIdWithHighestTrickCall();
                const winningPlayer = selectedRoom.getPlayer(winningSocketId);
                selectedRoom.phase = 'choosing-trump';
                selectedRoom.winningBidderSocketId = winningSocketId;
                selectedRoom.turnNo = winningPlayer.order;
                broadcastTrickCalls(selectedRoom);

                const winningSocket = roomNamespace.sockets.get(winningSocketId);
                if (winningSocket) {
                    winningSocket.emit('choose-trump', privatePlayer(winningPlayer));
                }
            }
            acceptEvent(acknowledge);
        });

        socket.on('set-trump', (trump, acknowledge) => {
            const selectedRoom = getSocketRoom(socket);
            if (!selectedRoom || selectedRoom.phase !== 'choosing-trump' ||
                selectedRoom.winningBidderSocketId !== socket.id) {
                rejectEvent(socket, 'set-trump', 'You cannot choose trump right now.', acknowledge);
                return;
            }
            if (!VALID_TRUMPS.has(trump)) {
                rejectEvent(socket, 'set-trump', 'Invalid trump color.', acknowledge);
                return;
            }

            selectedRoom.trump = trump;
            selectedRoom.setWeliAsTrump(trump);
            selectedRoom.increaseTrumpRank(trump);
            selectedRoom.phase = 'playing';
            displayTrump(selectedRoom);
            acceptEvent(acknowledge);
        });

        socket.on('play-card', (cardId, acknowledge) => {
            const selectedRoom = getSocketRoom(socket);
            const currentPlayer = getSocketPlayer(socket, selectedRoom);
            if (!currentPlayer) {
                rejectEvent(socket, 'play-card', 'You have not joined this room.', acknowledge);
                return;
            }
            registerPlayedCard(socket, selectedRoom, currentPlayer, cardId, acknowledge);
        });
    });

    return {
        app: app,
        io: io,
        rooms: rooms,
        server: server,
        start: port => new Promise(resolve => {
            server.listen(port, () => resolve(server.address()));
        }),
        stop: () => new Promise(resolve => {
            io.close(() => resolve());
        })
    };
}

function compareByOrder(player1, player2) {
    return player1.order - player2.order;
}

if (require.main === module) {
    const gameServer = createGameServer();
    gameServer.start(DEFAULT_PORT).then(() => {
        console.log('listening on port ' + DEFAULT_PORT);
    });
}

exports.createGameServer = createGameServer;
