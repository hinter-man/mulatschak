var socket = io('/lobby'); // io in namespace lobby

window.onload = function () {

    document.getElementById('addRoomBtn').onclick = addRoom;

    socket.on('update-room-list', function(data) {
        updateRoomList(data);
    });
};

//#region lobby functions
function addRoom() {
    var roomName = document.getElementById('room-name');
    if (roomName.value.trim() === '') {
        alert('Room name must not be empty!');
        return;
    }
    socket.emit('add-room', roomName.value.trim());

    roomName.value = '';
    roomName.focus();
}

function updateRoomList(rooms) {
    var roomList = document.getElementById('availableRooms');
    roomList.textContent = '';

    rooms.forEach(room => {
        var roomLink = document.createElement('a');
        var badge = document.createElement('span');

        roomLink.id = room.id;
        roomLink.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        roomLink.appendChild(document.createTextNode(room.name));

        badge.className = 'badge ' + (room.availableSeats ? 'badge-success' : 'badge-danger');
        badge.textContent = room.amountOfPlayers + '/4 Players';
        roomLink.appendChild(badge);

        if (!room.availableSeats) {
            roomLink.classList.add('disabled');
        } else {
            roomLink.href = '#';
            roomLink.addEventListener('click', function (event) {
                event.preventDefault();
                joinRoom(room.id);
            });
        }
        roomList.appendChild(roomLink);
    });
}

function joinRoom(id) {
    var username = document.getElementById('username').value.trim();
    if (username === '') {
        alert('Username must not be empty!');
        return;
    }
    var query = new URLSearchParams({ id: id, username: username });
    var url = './room.html?' + query.toString();
 
    window.location.href = url; 
}

//#endregion lobby functions