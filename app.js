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
var fps = 1000 / 30;
var DEBUG = true;

var Entity = function(id) {
    var self = {
        id: id,
        x: 250,
        y: 250,
        speedX: 0,
        speedY: 0
    }

    self.update = function() {
        self.updatePosition();
    }

    self.updatePosition = function() {
        self.x += self.speedX;
        self.y += self.speedY;
    }

    return self;
};

var Player = function(id) {
    var self = Entity(id);
    self.number = "" + Math.floor(10 * Math.random());
    self.pressingLeft =  false;
    self.pressingRight =  false;
    self.pressingUp =  false;
    self.pressingDown =  false;
    self.maxSpeed =  10;

    var super_update = self.update;
    self.update = function() {
        self.updateSpeed();
        super_update();
    }

    self.updateSpeed = function() {
        if (self.pressingUp) {
            self.speedY = -self.maxSpeed;
        } else if (self.pressingDown) {
            self.speedY = self.maxSpeed;
        } else {
            self.speedY = 0;
        }

        if (self.pressingLeft) {
            self.speedX = -self.maxSpeed;
        } else if (self.pressingRight) {
            self.speedX = self.maxSpeed;
        } else {
            self.speedX = 0;
        }
    }
    Player.list[id] = self;

    return self;
}

Player.list = {};
Player.onConnect = function(socket) {
    var player = Player(socket.id);

    socket.emit('player_id', player.id);
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

    socket.on('fire', function(data) {
        Bullet(data.x, data.y, data.angle);
    });
};
Player.update = function() {
    var players = [];

    for (var i in Player.list) {
        var player = Player.list[i];
        player.update();
        players.push({
            id: player.id,
            x: player.x,
            y: player.y,
            number: player.number
        });
    }

    return players;
}

Player.onDisconnect = function(socket) {
    delete Player.list[socket.id];
}

var Bullet = function(x, y, angle) {
    var self = Entity(Math.random());
    self.x = x;
    self.y = y;
    var rad = angle / 180 * Math.PI;
    self.speedX = Math.cos(rad) * 10;
    self.speedY = Math.sin(rad) * 10;

    self.timer = 0;
    self.toRemove = false;
    var super_update = self.update;
    self.update = function() {
        if (self.timer++ > 100) {
            self.toRemove = true;
        }
        super_update();
    }
    Bullet.list[self.id] = self;

    return self;
};
Bullet.list = {};
Bullet.update = function() {
    var bullets = [];

    for (var i in Bullet.list) {
        var bullet = Bullet.list[i];
        bullet.update();
        if (bullet.toRemove) {
            delete Bullet.list[i];
        } else {
            bullets.push({
                x: bullet.x,
                y: bullet.y,
            });
        }
    }

    return bullets;
}


var io = require('socket.io')(serv, {});
io.sockets.on('connection', function (socket) {
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    Player.onConnect(socket);

    socket.on('disconnect', function() {
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

    socket.on('sendMessage', function(message) {
        var playerName = ("" + socket.id).slice(2, 7);
        for (var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', playerName + ": " + message);
        }
    });

    socket.on('evalServer', function(data) {
        if (!DEBUG) {
            return;
        }
        var res = eval(data);
        socket.emit('evalAnswer', res);
    });
});

setInterval(function () {
    var package = {
        players: Player.update(),
        bullets: Bullet.update()
    };

    for (var i in SOCKET_LIST) {    
        var socket = SOCKET_LIST[i];
        socket.emit('newpositions', package);
    }
}, fps);