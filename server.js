(function() {
    'use strict';

    var CONFIG = require('./node-config.js');
    var util = require('./js/node-util.js');
    var http = require('http');
    var dgram = require('dgram');
    var ws = require("ws");
    var WebSocketServer = require("websocket").server;
    var ProtoBuf = require("protobufjs");
    var path = require("path");

    var CesiumSync = ProtoBuf.loadProtoFile("cesiumsync.proto").build("CesiumSync");

    var server = http.createServer();

    server.listen(CONFIG.NODE_SERVER_PORT, function() {
        console.log("WS Relay Server listening on " + CONFIG.NODE_SERVER_IP + ":" + CONFIG.NODE_SERVER_PORT);
    });


    var wsServer = new ws.Server({
        server: server
    });


    var clientWSCount = 0, activeWSClientCount = 0;
    var wsClients = {};

    //Preserving State
    var state_sync = new CesiumSync();
    var camera_sync = new CesiumSync();
    state_sync.msgtype = 3;
    camera_sync.msgtype = 1;

    wsServer.on("connection", function(socket) { // Port 8081

        //Keep count of all connected clients
        var id = clientWSCount++;
        activeWSClientCount++;
        //Store connection object for each of the clients
        wsClients[id] = socket;
        console.log((new Date()) + ' Connection accepted [' + id + '], Active clients '+ activeWSClientCount);
	if(activeWSClientCount>1) {
	    console.log("Slave Connected. Sending Preserved State to Slave.");
            wsClients[id].send(camera_sync.toBuffer());
            wsClients[id].send(state_sync.toBuffer());
	}

        //On receiving message (Camera Properties) from the Master
        socket.on("message", function(data, flags) {
            if (flags.binary) {
                try {
                    // Decode the Message
                    var sync = CesiumSync.decode(data);
                    console.log("Received: " + sync.msgtype);
                    //Broadcast camera properties to connected clients
                    for (var i in wsClients) {
                        if (wsClients[i] != socket)
                            wsClients[i].send(sync.toBuffer());
                    }
		
		   //Update Preserved State
		    if(sync.msgtype!=3)
			camera_sync = sync;
		    else {
			
			if(sync.lighting!=null)
				state_sync.lighting = sync.lighting;
			if(sync.fog!=null)
				state_sync.fog = sync.fog;
			if(sync.terrainProvider!=null)
				state_sync.terrainProvider = sync.terrainProvider;
			if(sync.imageryProvider!=null)
				state_sync.imageryProvider = sync.imageryProvider;
			if(sync.sceneMode!=null)
				state_sync.sceneMode = sync.sceneMode;
			if(sync.slaveFPS!=null)
				state_sync.slaveFPS = sync.slaveFPS;

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
            activeWSClientCount--;
            console.log((new Date()) + ' Peer ' + id + ' disconnected. Still have '+activeWSClientCount+' clients');
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
    var lastGESyncString = '';

    UDPserver.on('listening', function() {
        var address = UDPserver.address();
        console.log('UDP Relay Server listening on ' + CONFIG.UDP_HOST + ":" + CONFIG.UDP_PORT);
    });

    UDPserver.on('message', function(message, remote) {

        var viewsync = String(message).split(',');

        var s = new CesiumSync();
        s.msgtype = 2;
        s.lat = parseFloat(viewsync[1]) * 10e5;
        s.lon = parseFloat(viewsync[2]) * 10e5;
        s.ht = parseFloat(viewsync[3]) * 100;
        s.heading = Math.round(util.toRadians(parseFloat(viewsync[4])) * 10e4);
        s.pitch = Math.round(util.toRadians((parseFloat(viewsync[5]) - 90)) * 10e4);
    s.roll = Math.round(util.toRadians(parseFloat(viewsync[6])) * 10e3);

    var syncString = s.lat+','+s.lon+','+s.alt+','+s.heading+','+s.pitch+','+s.roll;

    if (syncString != lastGESyncString) {
        lastGESyncString = syncString;
        var msg = s.toBuffer();

        for (var i in wsClients) {
            wsClients[i].send(msg);
        }

            // UDPclient.send(thisSync,0,thisSync.length,CONFIG.CesiumSyncPort,CONFIG.CesiumSyncHost);
        }
    });

    UDPserver.bind(CONFIG.UDP_PORT, CONFIG.UDP_HOST);

})();
