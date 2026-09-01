'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../Room').Room;
const deck = require('../Deck');

test('can add players after trump ranks are increased', () => {
    const room = new Room(0, 'Room');
    room.addPlayer('one', 0, 'One');
    room.deck = deck.createDeck();
    room.increaseTrumpRank('herz');

    assert.equal(room.addPlayer('two', 0, 'Two'), true);
    assert.equal(room.amountOfPlayers, 2);
});

test('selecting the highest bid does not reorder players', () => {
    const room = new Room(0, 'Room');
    room.addPlayer('one', 0, 'One');
    room.addPlayer('two', 0, 'Two');
    room.players[0].order = 1;
    room.players[1].order = 2;
    room.players[0].trickCall = 2;
    room.players[1].trickCall = 5;

    assert.equal(room.getSocketIdWithHighestTrickCall(), 'two');
    assert.deepEqual(room.players.map(player => player.socketId), ['one', 'two']);
});

test('reset clears active game state', () => {
    const room = new Room(0, 'Room');
    room.addPlayer('one', 0, 'One');
    room.phase = 'playing';
    room.trump = 'herz';
    room.playedCards.set(room.players[0], { id: 'herz_7' });

    room.resetGameData();

    assert.equal(room.phase, 'waiting');
    assert.equal(room.trump, '');
    assert.equal(room.playedCards.size, 0);
    assert.equal(room.players[0].points, 20);
});
