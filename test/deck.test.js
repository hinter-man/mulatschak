'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Card = require('../Card').Card;
const deck = require('../Deck');

test('requires a player to follow suit when possible', () => {
    const lead = new Card('herz_10', 'herz', '10', 10);
    const matching = new Card('herz_7', 'herz', '7', 7);
    const offSuit = new Card('eichel_sau', 'eichel', 'sau', 15);

    assert.equal(
        deck.checkPlayedCardFromPlayer([lead], offSuit, [matching, offSuit], 'pik'),
        false
    );
    assert.equal(
        deck.checkPlayedCardFromPlayer([lead], matching, [matching, offSuit], 'pik'),
        true
    );
});

test('allows a lower trump when no higher trump is available', () => {
    const lead = new Card('herz_sau', 'herz', 'sau', 15);
    const playedTrump = new Card('pik_10', 'pik', '10', 20);
    const lowerTrump = new Card('pik_7', 'pik', '7', 17);

    assert.equal(
        deck.checkPlayedCardFromPlayer(
            [lead, playedTrump],
            lowerTrump,
            [lowerTrump],
            'pik'
        ),
        true
    );
});

test('rejects a card that is missing from the hand', () => {
    const lead = new Card('herz_10', 'herz', '10', 10);

    assert.equal(deck.checkPlayedCardFromPlayer([lead], undefined, [], 'pik'), false);
});
