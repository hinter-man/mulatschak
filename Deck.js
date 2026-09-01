let card = require('./Card');

function createDeck() {
    var color = new Array('herz', 'eichel', 'pik', 'schelle');
    var value = new Array('7', '8', '9', '10', 'unter', 'ober', 'koenig', 'sau');
    var rank = new Array(7, 8, 9, 10, 11, 12, 13, 15); // skip 14 for weli

    var deck = [];

    for (var i = 0; i < color.length; i++) {
        for (var j = 0; j < value.length; j++) {
            deck.push(new card.Card(color[i] + '_' + value[j],
                color[i],
                value[j],
                rank[j]));
        }
    }

    // adding weli, which is a special card, always one rank higher 
    // as koenig and one rank lower than sau
    deck.push(new card.Card('weli', 'schelle', 'weli', 14));

    return shuffleDeck(deck); // returns shuffled deck
}

function shuffleDeck(deck) {
    var i = deck.length,
        j, tempi, tempj;
    if (i === 0) return false;
    while (--i) {
        j = Math.floor(Math.random() * (i + 1));
        tempi = deck[i];
        tempj = deck[j];
        deck[i] = tempj;
        deck[j] = tempi;
    }
    return deck;
}

function draw(deck, amount, hand) {

    // splice returns amout of cards to drawnCards, and crops it from itself
    var drawnCards = deck.splice(0, amount);

    // in hand is not empty, push drawn cards to current hand
    if (hand.length > 0) {
        drawnCards.push.apply(drawnCards, hand);
    }
    return drawnCards;
}

function checkPlayedCardFromPlayer(playedCards, actualCard, playersHand, trump) {

    if (!actualCard || playedCards.length === 0) {
        return false;
    }

    let firstCard = playedCards[0];
    // fetch highest card
    let highestCard = getHighestCard(playedCards, trump);

    // players cards which have same color as first card
    let actualPlayerSameColor = playersHand.filter(card => card.color === firstCard.color);
    if (actualPlayerSameColor.length > 0) {
        // player can follow suite rule
        let higherCardsSameColor = actualPlayerSameColor.filter(card => card.cardRank > highestCard.cardRank);
        if (higherCardsSameColor.length > 0) {
            // follow suite and value rule
            return higherCardsSameColor.indexOf(actualCard) >= 0;
        } else {
            // player can only follow suite rule
            return actualPlayerSameColor.indexOf(actualCard) >= 0;
        }
    } else {
        // player cannot follow suite rule
        // check if player has trump
        let actualPlayerTrumpCards = playersHand.filter(card => card.color === trump);
        if (actualPlayerTrumpCards.length > 0) {
            // player has trump 
            let higherCardsTrumpColor = actualPlayerTrumpCards.filter(card => card.cardRank > highestCard.cardRank);
            if (higherCardsTrumpColor.length > 0) { // players hand contains a higher card than highest card played
                return higherCardsTrumpColor.indexOf(actualCard) >= 0;
            }
            return actualPlayerTrumpCards.indexOf(actualCard) >= 0;
        } else {
            // player cannot follow any rule
            return true;
        }
    }
}

function getPlayerIdxWithHighestCard(playedCardsMap, trump) {
    var cards = Array.from(playedCardsMap.values());
    var players = Array.from(playedCardsMap.keys());
    var highestCard = getHighestCard(cards, trump);

    return players[cards.indexOf(highestCard)];
}

function getHighestCard(cards, trump) {
    var firstCard = cards[0];
    var sortedCards = cards.filter(card => card.color === firstCard.color ||
        card.color === trump).sort(compareByRank);
    return sortedCards[0];
}

function compareByRank(card1, card2) {
    return card2.cardRank - card1.cardRank;
}

exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.draw = draw;
exports.getPlayerIdxWithHighestCard = getPlayerIdxWithHighestCard;
exports.checkPlayedCardFromPlayer = checkPlayedCardFromPlayer;