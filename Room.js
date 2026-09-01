const MAX_PLAYERS = 4;
const Player = require('./Player').Player;
const deck = require('./Deck'); // used for generating random order no

class Room {

    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.amountOfPlayers = 0;
        this.players = [];
        this.availableSeats = true;
        this.trump = '';
        this.turnNo = 0;
        this.playedCards = new Map(); // temp map for player and played cards in round
        this.deck = [];
        this.round = 0;
        this.phase = 'waiting';
        this.biddingTurnNo = 0;
        this.winningBidderSocketId = null;
    }

    addPlayer(id, roomId, name) {
        if (!this.availableSeats) {
            return false;
        }

        this.players.push(new Player(id, roomId, name));
        this.amountOfPlayers = this.players.length;
        this.availableSeats = (this.amountOfPlayers < MAX_PLAYERS); // max 4 players in one room
        return true;
    }

    removePlayer(socketId) {
        this.players = this.players.filter(p => p.socketId !== socketId);
        this.amountOfPlayers = this.players.length;
        this.availableSeats = (this.amountOfPlayers < MAX_PLAYERS);
    }

    getPlayer(socketId) {
        for (let i = 0; i < this.players.length; i++) {
            const element = this.players[i];
            if (element.socketId === socketId) {
                return element;
            }
        }
    }

    getNextPlayer(currentOrder) {
        for (let i = 0; i < this.players.length; i++) {
            const element = this.players[i];
            if (element.order == (Number(currentOrder) + 1)) {
                return element;
            }
        }
    }

    setTrickCall(socketId, trickCall) {
        this.players.forEach(p => {
            if (p.socketId === socketId) {
                p.trickCall = trickCall;
            }
        });
    }

    getSocketIdWithHighestTrickCall() {
        var maxTrickCallPlayer = this.players.slice().sort(compareByTrickCall)[0];
        
        this.players.forEach(p => {
            if (p.socketId !== maxTrickCallPlayer.socketId) {
                p.trickCall = 0;
            }
        });

        return maxTrickCallPlayer.socketId;
    }

    // sets specific player ready and checks if everyone is ready
    setPlayerReady(socketId) {
        var count = 0;
        this.players.forEach(player => {
            if (player.socketId === socketId) {
                player.ready = true;
            }

            // if actual player is ready, increase count
            if (player.ready) {
                count++;
            }
        });
        return (count === 4); // returns true if every player is ready, otherwise false
    }

    setRandomOrder() {
        var orderNos = [1, 2, 3, 4];
        orderNos = deck.shuffleDeck(orderNos);

        for (let i = 0; i < this.players.length; i++) {
            this.players[i].order = orderNos[i];
        }
    }

    setTurnNo() {
        this.turnNo++;
        if (this.turnNo > this.amountOfPlayers) {
            this.turnNo = 1;
        }
    }

    setWeliAsTrump(trump) {
        // either search weli in deck or in players hand
        var weli = this.deck.find(card => card.id === 'weli');
        if (weli) { // deck
            weli.color = trump;
            return true;
        } else { // players hand
            for (let i = 0; i < this.players.length; i++) {
                weli = this.players[i].hand.find(card => card.id === 'weli');
                if (weli) {
                    weli.color = trump;
                    return true;
                }
            }
        }
        return false;
    }

    increaseTrumpRank(trump) {

        // this function brings an advantage in comparing cards
        // even the smallest trump is higher than the highest "normal" card

        // increaes trumps in deck
        for (let i = 0; i < this.deck.length; i++) {
            if (this.deck[i].color === trump) {
                this.deck[i].cardRank += 10;

            }
        }
        // increases trumps in players hand
        for (let i = 0; i < this.players.length; i++) {
            const currentPlayer = this.players[i];
            for (let j = 0; j < currentPlayer.hand.length; j++) {
                if (currentPlayer.hand[j].color === trump) {
                    currentPlayer.hand[j].cardRank += 10;
                }
            }
        }
    }

    isGameOver() {
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            if (player.points < 1 || player.points > 99)
                return true;
        }
        return false;
    }

    resetGameData() {
        // prepare room for new game
        this.trump = '';
        this.turnNo = 0;
        this.round = 0;
        this.phase = 'waiting';
        this.biddingTurnNo = 0;
        this.winningBidderSocketId = null;
        this.deck = [];
        this.playedCards.clear();

        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            player.resetPlayer();
        }

    }
}

function compareByTrickCall(player1, player2) {
    return player2.trickCall - player1.trickCall;
}

exports.Room = Room;