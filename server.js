(function() {
    'use strict';

    var CONFIG = require('./js/node-config.js');
    var http = require('http');
    var dgram = require('dgram');
    var ws = require("ws");
    var WebSocketServer = require("websocket").server;
    var ProtoBuf = require("protobufjs");
    var path = require("path");

    var builder = ProtoBuf.loadProtoFile(path.join(__dirname, "cesium.proto")),
        Message = builder.build("Message");


    var server = http.createServer(function(req, res) {
        var file = null,
            type = "text/html";
        if (req.url == "/") {
            file = "index.html";
        } else if (/^\/(\w+(?:\.min)?\.(?:js|html|proto))$/.test(req.url)) {
            file = req.url.substring(1);
            if (/\.js$/.test(file)) {
                type = "text/javascript";
            }
        }
        if (file) {
            fs.readFile(path.join(__dirname, file), function(err, data) {
                if (err) {
                    res.writeHead(500, {
                        "Content-Type": type
                    });
                    res.end("Internal Server Error: " + err);
                } else {
                    res.writeHead(200, {
                        "Content-Type": type
                    });
                    res.write(data);
                    res.end();
                    console.log("Served " + file);
                }
            });
        } else {
            res.writeHead(404, {
                "Content-Type": "text/html"
            });
            res.end("Not Found");
        }
    });

    server.listen(CONFIG.NODE_SERVER_PORT, function() {
        console.log("WS Relay Server listening on " + CONFIG.NODE_SERVER_IP + ":" + CONFIG.NODE_SERVER_PORT);
    });


    var wsServer = new ws.Server({
        server: server
    });


    var count = 0;
    var wsClients = {};

    wsServer.on("connection", function(socket) { // Port 8081

        //Keep count of all connected clients	
        var id = count++;
        //Store connection object for each of the clients
        wsClients[id] = socket;
        console.log((new Date()) + ' Connection accepted [' + id + ']');


        //On receiving message (Camera Properties) from the Master
        socket.on("message", function(data, flags) {
            if (flags.binary) {
                try {
                    // Decode the Message
                    var msg = Message.decode(data);
                    console.log("Received: " + msg.msgtype);
                    //Broadcast camera properties to connected clients
                    for (var i in wsClients) {
                        if (wsClients[i] != socket)
                            wsClients[i].send(msg.toBuffer());
                    }

                } catch (err) {
                    console.log("Processing failed:", err);
                }
            } else {
                console.log("Not binary data");
            }
        });
        socket.on("close", function(reasonCode, description) {
            delete wsClients[id];
            console.log((new Date()) + ' Peer ' + socket.remoteAddress + ' disconnected.');
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
    var lastGEMsg = '';

    UDPserver.on('listening', function() {
        var address = UDPserver.address();
        console.log('UDP Relay Server listening on ' + CONFIG.UDP_HOST + ":" + CONFIG.UDP_PORT);
    });

    UDPserver.on('message', function(message, remote) {

	var msgString = String(message);

	// Avoids sending duplicate camera position
	if (msgString != lastGEMsg) {

		var msgArray = String(message).split(',');
		var lastMsg = String(message);

		//if(clients[i]!=connection)
		var lat = parseFloat(msgArray[1]);
		var lon = parseFloat(msgArray[2]);
		var alt = parseFloat(msgArray[3]);
		var heading = parseFloat(msgArray[4]) * Math.PI / 180;
		var pitch = (parseFloat(msgArray[5]) - 90) * Math.PI / 180;
		var roll = parseFloat(msgArray[6]) * Math.PI / 180;
		var msgToWSClients = new Message();
		msgToWSClients.msgtype = "ge-cam";
		msgToWSClients.lon = lon;
		msgToWSClients.lat = lat;
		msgToWSClients.ht = alt;
		msgToWSClients.heading = heading;
		msgToWSClients.pitch = pitch;
		msgToWSClients.roll = roll;

		lastGEMsg = msgString;

		for (var i in wsClients) {
		    wsClients[i].send(msgToWSClients.toBuffer());
		}

	}

    });

    UDPserver.bind(CONFIG.UDP_PORT, CONFIG.UDP_HOST);

})();
