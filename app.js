var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client/index.html');
});

app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);

console.log("Server started.");

var SOCKET_LIST = {};
var PLAYER_LIST = {};
var fps = 1000 / 30;

var Player = function(id) {
    var self = {
        id: id,
        x: 250,
        y: 250,
        number: "" + Math.floor(10 * Math.random()),
        pressingLeft: false,
        pressingRight: false,
        pressingUp: false,
        pressingDown: false,
        maxSpeed: 10
    }

    self.updatePosition = function() {
        if (self.pressingUp) {
            self.y -= self.maxSpeed;
        }
        if (self.pressingDown) {
            self.y += self.maxSpeed;
        }
        if (self.pressingLeft) {
            self.x -= self.maxSpeed;
        }
        if (self.pressingRight) {
            self.x += self.maxSpeed;
        }
    }

    return self;
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function (socket) {
    socket.id = Math.random();

    var player = Player(socket.id);

    SOCKET_LIST[socket.id] = socket;
    PLAYER_LIST[socket.id] = player;

    socket.on('keyPress', function(data) {
        switch (data.inputId) {
            case 'up':
                player.pressingUp = data.state;
                break;
            case 'down':
                player.pressingDown = data.state;
                break;
            case 'left':
                player.pressingLeft = data.state;
                break;
            case 'right':
                player.pressingRight = data.state;
                break;
        }
    });

    socket.on('disconnect', function() {
        delete SOCKET_LIST[socket.id];
        delete PLAYER_LIST[socket.id];
    });
});

setInterval(function () {
    var pack = [];

    for (var i in PLAYER_LIST) {
        var player = PLAYER_LIST[i];
        player.updatePosition();
        pack.push({
            x: player.x,
            y: player.y,
            number: player.number
        });
    }

    for (var i in SOCKET_LIST) {    
        var socket = SOCKET_LIST[i];
        socket.emit('newpositions', pack);
    }
}, fps);