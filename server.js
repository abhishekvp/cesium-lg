(function() {
    'use strict';

    var CONFIG = require('./js/node-config.js');
    var http = require('http');
    var dgram = require('dgram');
    var WebSocketServer = require("websocket").server;


    function handleRequest(request, response) {
        response.end('It Works!! Path Hit: ' + request.url);
    }

    var server = http.createServer(handleRequest);

    server.listen(CONFIG.NODE_SERVER_PORT, function() {
        console.log("WS Relay Server listening on " + CONFIG.NODE_SERVER_IP + ":" + CONFIG.NODE_SERVER_PORT);
    });


    var wsServer = new WebSocketServer({
        'httpServer': server
    });


    var count = 0;
    var wsClients = {};

    wsServer.on("request", function(request) { // Port 8081
        var connection = request.accept('echo-protocol', request.origin);
        //Keep count of all connected clients	
        var id = count++;
        //Store connection object for each of the clients
        wsClients[id] = connection;
        console.log((new Date()) + ' Connection accepted [' + id + ']');

        //On receiving message (Camera Properties) from the Master
        connection.on("message", function(message) {
            console.log(message.utf8Data);
            //Broadcast camera properties to connected clients
            for (var i in wsClients) {
                if (wsClients[i] != connection)
                    wsClients[i].send(message.utf8Data);
            }
        })
        connection.on("close", function(reasonCode, description) {
            delete wsClients[id];
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        })
    });

    server.on('error', function(e) {
        if (e.code === 'EADDRINUSE') {
            console.log('Error: Port is already in use, select a different port.');
        } else if (e.code === 'EACCES') {
            console.log('Error: This process does not have permission to listen on port' + CONFIG.NODE_SERVER_PORT);
        }
        console.log(e);
        process.exit(1);
    });

    server.on('close', function() {
        console.log('WS Relay Server stopped.');
    });

    var isFirstSig = true;
    process.on('SIGINT', function() {
        if (isFirstSig) {
            console.log('WS Relay Server shutting down.');
            server.close(function() {
                process.exit(0);
            });
            isFirstSig = false;
        } else {
            console.log('WS Relay Server force kill.');
            process.exit(1);
        }
    });


    var UDPserver = dgram.createSocket('udp4');

    UDPserver.on('listening', function() {
        var address = UDPserver.address();
        console.log('UDP Relay Server listening on ' + CONFIG.UDP_HOST + ":" + CONFIG.UDP_PORT);
    });

    UDPserver.on('message', function(message, remote) {

        var msgArray = String(message).split(',');

        //if(clients[i]!=connection)
        var lat = msgArray[1];
        var lon = msgArray[2];
        var alt = msgArray[3];
        var heading = msgArray[4] * Math.PI / 180;
        var pitch = (msgArray[5] - 90) * Math.PI / 180;
        var roll = msgArray[6] * Math.PI / 180;
        var msgToWSClients = '{"msg-type":"ge-cam", "lon":' + lon + ',"lat":' + lat + ',"ht":' + alt + ',"heading":' + heading + ',"pitch":' + pitch + ',"roll":' + roll + '}';

        for (var i in wsClients) {
            wsClients[i].send(msgToWSClients);
        }

    });

    UDPserver.bind(CONFIG.UDP_PORT, CONFIG.UDP_HOST);

})();
