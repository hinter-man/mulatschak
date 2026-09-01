//#region globals
var socket = io('/room'); // io in namespace room
var svgNamespace = 'http://www.w3.org/2000/svg';
var svgXlink = 'http://www.w3.org/1999/xlink';

var roomId;
var cards, playedCards, trumpGroup;
var trickCallButtons = new Map();
var actualPlayer;
var playedCardsX = 35;

//#endregion globals

//#region window
$(window).ready(function () {
    cards = document.getElementById('cards');
    playedCards = document.getElementById('played-cards');
    trumpGroup = document.getElementById('trump-group');

    // register some click listeners
    registerClickListeners();

    var params = new URLSearchParams(location.search);
    roomId = params.get('id');

    // client sends room and username in which he wants to join
    socket.emit('join-room', {
        roomId: roomId,
        username: params.get('username')
    }, function (result) {
        if (!result.ok) {
            window.location.href = './index.html';
        }
    });

    socket.on('update-player-list', function (data) {
        updatePlayerList(data);
    });

    socket.on('update-points', function (room) {
        updatePoints(room);
    });

    socket.on('room-data', function (data) {
        updateRoomData(data);
    });

    socket.on('start-round', function (player) {
        actualPlayer = player;
        startRound();
    });

    socket.on('show-trick-modal', function (player) {
        actualPlayer = player;
        showTrickCallModal();
    });

    socket.on('choose-trump', function (player) {
        actualPlayer = player;
        showChooseTrumpModal();
    });

    socket.on('disable-trick-button', function (value) {
        // disable all buttons till value (except 0 - NONE and 1 - NOT AVAILABLE)
        for (let key = 2; key < value; key++) {
            let buttonToDisable = trickCallButtons.get(key.toString());
            document.getElementById(buttonToDisable).disabled = true;
        }

        // disable button of last call, or 0 - NONE button, if player is last caller and nobody has called a trick 
        let buttonToDisable = trickCallButtons.get(value.toString());
        document.getElementById(buttonToDisable).disabled = true;
    });

    socket.on('enable-trick-button', () => {
        for (var value of trickCallButtons.values()) {
            document.getElementById(value).disabled = false;
        }
    });

    socket.on('update-cards', function (player) {
        actualPlayer = player;
        handoutCards();
    });

    socket.on('update-played-cards', function (card) {
        updatePlayedCards(card);
    });

    socket.on('display-trump', function (trump) {
        displayTrump(trump);
    });

    socket.on('player-trick-calls', function (players) {
        updatePlayerTrickCalls(players);
    });

    socket.on('game-over', () => {
        $('#end-view').fadeIn();
    });

    socket.on('game-aborted', function (message) {
        alert(message);
        actualPlayer = undefined;
        clearHand();
        updatePlayedCards(undefined);
        displayTrump(undefined);
        updatePlayerTrickCalls();
        $('.modal').modal('hide');
        $('#end-view').hide();
        $('#start-view').fadeIn();
    });

    socket.on('game-error', function (error) {
        console.warn(error.message);
    });

});

$(window).on('beforeunload', function () {
    return confirm('Do you really want to close?');
});

//#endregion window

//#region room functions
function updatePlayerList(room) {
    var players = room.players;
    var actualTurnNo = room.turnNo;

    var playerNames = document.getElementById('player-names');
    playerNames.textContent = '';

    // player names are table headers
    players.forEach(player => {
        if (player.ready) {
            var playerName = document.createElement('th');
            playerName.textContent = player.name;
            if (player.order === (actualTurnNo) && player.order !== 0) {
                playerName.className = 'bg-danger';
            }
            playerNames.appendChild(playerName);
        }
    });
}

function updatePoints(room) {

    var playerPoints = document.getElementById('player-points');
    var pointsRow = document.createElement('tr');
    room.players.forEach(player => {
        var points = document.createElement('td');
        points.textContent = player.points;
        pointsRow.appendChild(points);
    });
    playerPoints.appendChild(pointsRow);
}

function updateRoomData(room) {

    document.title = room.id + ': ' + room.name; 
    $('#room-h1').text(room.name);

}

function registerClickListeners() {

    // trick calls
    let trickCallBtn2 = document.getElementById('trick-call-btn2');
    trickCallButtons.set(trickCallBtn2.value, trickCallBtn2.id);
    trickCallBtn2.onclick = setTrickCall;

    let trickCallBtn3 = document.getElementById('trick-call-btn3');
    trickCallButtons.set(trickCallBtn3.value, trickCallBtn3.id);
    trickCallBtn3.onclick = setTrickCall;

    let trickCallBtn4 = document.getElementById('trick-call-btn4');
    trickCallButtons.set(trickCallBtn4.value, trickCallBtn4.id);
    trickCallBtn4.onclick = setTrickCall;

    let trickCallBtn5 = document.getElementById('trick-call-btn5');
    trickCallButtons.set(trickCallBtn5.value, trickCallBtn5.id);
    trickCallBtn5.onclick = setTrickCall;

    let trickCallBtnMulatschak = document.getElementById('trick-call-btnMulatschak');
    trickCallButtons.set(trickCallBtnMulatschak.value, trickCallBtnMulatschak.id);
    trickCallBtnMulatschak.onclick = setTrickCall;

    let trickCallBtnNone = document.getElementById('trick-call-btnNone');
    trickCallButtons.set(trickCallBtnNone.value, trickCallBtnNone.id);
    trickCallBtnNone.onclick = setTrickCall;

    // trump choosing
    document.getElementById('choose-trump-color_herz').onclick = setTrump;
    document.getElementById('choose-trump-color_eichel').onclick = setTrump;
    document.getElementById('choose-trump-color_pik').onclick = setTrump;
    document.getElementById('choose-trump-color_schelle').onclick = setTrump;

    $('#start-view').click(function () {
        socket.emit('set-ready');
        $(this).fadeOut();
    });

    $('#end-view').click(function () {
        socket.emit('set-ready');
        $(this).fadeOut();
    });

}

function updatePlayerTrickCalls(players) {
    var playerTrickCalls = document.getElementById('player-trick-calls');
    playerTrickCalls.textContent = '';
    if (players) {
        players.forEach(player => {
            var trickCall = document.createElement('td');
            if (player.trickCall != 0) {
                trickCall.textContent = player.trickCalls + '/' + player.trickCall;
            } else {
                trickCall.textContent = player.trickCalls;
            }
            playerTrickCalls.appendChild(trickCall);
        });
    }
}

//#endregion room functions

//#region player functions

function startRound() {
    handoutCards();

    if (actualPlayer.order === 1) {
        showTrickCallModal();
    }
}

function handoutCards() {
    clearHand();

    var hand = actualPlayer.hand;
    var x = 22;
    hand.forEach(playersCard => {
        var card = document.createElementNS(svgNamespace, 'use');
        card.setAttribute('class', 'card');
        card.setAttribute('id', playersCard.id);
        card.setAttribute('x', '' + x + '%');
        card.setAttribute('y', '70%');
        card.setAttributeNS(svgXlink, 'href', '#' + playersCard.id);
        card.addEventListener('click', playCard);
        cards.appendChild(card);
        x += 11.5;
    });
}

function clearHand() {
    while (cards.firstChild) {
        cards.removeChild(cards.firstChild);
    }
}

function updatePlayedCards(playedCard) {

    if (playedCard) {
        var card = document.createElementNS(svgNamespace, 'use');
        card.setAttribute('id', playedCard.id);
        card.setAttribute('x', '' + playedCardsX + '%');
        card.setAttribute('y', '30%');
        card.setAttributeNS(svgXlink, 'href', '#' + playedCard.id);
        playedCards.appendChild(card);
        playedCardsX += 5;
    } else {
        // remove played cards, new round has started
        while (playedCards.firstChild) {
            playedCards.removeChild(playedCards.firstChild);
        }
        playedCardsX = 40;
        return;
    }
}

function displayTrump(trumpId) {

    while (trumpGroup.firstChild) {
        trumpGroup.removeChild(trumpGroup.firstChild);
    }
    if (trumpId) {
        var trump = document.createElementNS(svgNamespace, 'use');
        trump.setAttribute('id', trumpId);
        trump.setAttribute('x', '10%');
        trump.setAttribute('y', '80%');
        trump.setAttributeNS(svgXlink, 'href', '#color_' + trumpId);
        trumpGroup.appendChild(trump);
    }
}

function showTrickCallModal() {
    $('#trick-calls').modal('show');
}

function showChooseTrumpModal() {
    $('#choose-trump').modal('show');
}

var setTrickCall = function () {
    if (actualPlayer) {
        socket.emit('set-trick-call', Number(this.value));
        $('#trick-calls').modal('hide');
    }
};

var setTrump = function () {
    var trump = this.alt;
    socket.emit('set-trump', trump);
    $('#choose-trump').modal('hide');
};

var playCard = function () {
    socket.emit('play-card', this.id);
};

//#endregion player functions