(function() {
    'use strict';
    /*jshint node:true*/

    var CONFIG = require('./Apps/js/config.js');

    var express = require('express');
    var WebSocketServer = require("websocket").server;
    var compression = require('compression');
    var url = require('url');
    var request = require('request');






    var yargs = require('yargs').options({
        'port' : {
            'default' : CONFIG.NODE_SERVER_PORT,
            'description' : 'Port to listen on.'
        },
        'public' : {
            'type' : 'boolean',
            'description' : 'Run a public server that listens on all interfaces.'
        },
        'upstream-proxy' : {
            'description' : 'A standard proxy server that will be used to retrieve data.  Specify a URL including port, e.g. "http://proxy:8000".'
        },
        'bypass-upstream-proxy-hosts' : {
            'description' : 'A comma separated list of hosts that will bypass the specified upstream_proxy, e.g. "lanhost1,lanhost2"'
        },
        'help' : {
            'alias' : 'h',
            'type' : 'boolean',
            'description' : 'Show this help.'
        }
    });
    var argv = yargs.argv;

    if (argv.help) {
        return yargs.showHelp();
    }

    // eventually this mime type configuration will need to change
    // https://github.com/visionmedia/send/commit/d2cb54658ce65948b0ed6e5fb5de69d022bef941
    // *NOTE* Any changes you make here must be mirrored in web.config.
    var mime = express.static.mime;
    mime.define({
        'application/json' : ['czml', 'json', 'geojson', 'topojson'],
        'model/vnd.gltf+json' : ['gltf'],
        'model/vnd.gltf.binary' : ['bgltf', 'glb'],
        'text/plain' : ['glsl']
    });

    var app = express();
    app.use(compression());
    app.use(express.static(__dirname));

    function getRemoteUrlFromParam(req) {
        var remoteUrl = req.params[0];
        if (remoteUrl) {
            // add http:// to the URL if no protocol is present
            if (!/^https?:\/\//.test(remoteUrl)) {
                remoteUrl = 'http://' + remoteUrl;
            }
            remoteUrl = url.parse(remoteUrl);
            // copy query string
            remoteUrl.search = url.parse(req.url).search;
        }
        return remoteUrl;
    }

    var dontProxyHeaderRegex = /^(?:Host|Proxy-Connection|Connection|Keep-Alive|Transfer-Encoding|TE|Trailer|Proxy-Authorization|Proxy-Authenticate|Upgrade)$/i;

    function filterHeaders(req, headers) {
        var result = {};
        // filter out headers that are listed in the regex above
        Object.keys(headers).forEach(function(name) {
            if (!dontProxyHeaderRegex.test(name)) {
                result[name] = headers[name];
            }
        });
        return result;
    }

    var upstreamProxy = argv['upstream-proxy'];
    var bypassUpstreamProxyHosts = {};
    if (argv['bypass-upstream-proxy-hosts']) {
        argv['bypass-upstream-proxy-hosts'].split(',').forEach(function(host) {
            bypassUpstreamProxyHosts[host.toLowerCase()] = true;
        });
    }

    app.get('/proxy/*', function(req, res, next) {
        // look for request like http://localhost:8080/proxy/http://example.com/file?query=1
        var remoteUrl = getRemoteUrlFromParam(req);
        if (!remoteUrl) {
            // look for request like http://localhost:8080/proxy/?http%3A%2F%2Fexample.com%2Ffile%3Fquery%3D1
            remoteUrl = Object.keys(req.query)[0];
            if (remoteUrl) {
                remoteUrl = url.parse(remoteUrl);
            }
        }

        if (!remoteUrl) {
            return res.status(400).send('No url specified.');
        }

        if (!remoteUrl.protocol) {
            remoteUrl.protocol = 'http:';
        }

        var proxy;
        if (upstreamProxy && !(remoteUrl.host in bypassUpstreamProxyHosts)) {
            proxy = upstreamProxy;
        }

        // encoding : null means "body" passed to the callback will be raw bytes

        request.get({
            url : url.format(remoteUrl),
            headers : filterHeaders(req, req.headers),
            encoding : null,
            proxy : proxy
        }, function(error, response, body) {
            var code = 500;

            if (response) {
                code = response.statusCode;
                res.header(filterHeaders(req, response.headers));
            }

            res.status(code).send(body);
        });
    });

var server = app.listen(argv.port, argv.public ? undefined : CONFIG.NODE_SERVER_IP, function() {
    console.log('Cesium development server running on '+server.address().address+':'+ server.address().port);
    if (argv.public) {
        console.log('Be aware this server is listening on all interfaces');
    }
}); // Server - Clients

var wsServer = new WebSocketServer({'httpServer': server});


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
	connection.on("message", function(message)
	{
 	console.log(message.utf8Data);
		//Broadcast camera properties to connected clients
 		for(var i in wsClients){
		if(wsClients[i]!=connection)
		wsClients[i].send(message.utf8Data);
   		}
	})
	connection.on("close", function(reasonCode, description)
	{
   	  delete wsClients[id];
    	  console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
	})
});

    server.on('error', function (e) {
        if (e.code === 'EADDRINUSE') {
            console.log('Error: Port %d is already in use, select a different port.', argv.port);
            console.log('Example: node server.js --port %d', argv.port + 1);
        } else if (e.code === 'EACCES') {
            console.log('Error: This process does not have permission to listen on port %d.', argv.port);
            if (argv.port < 1024) {
                console.log('Try a port number higher than 1024.');
            }
        }
        console.log(e);
        process.exit(1);
    });

    server.on('close', function() {
        console.log('Cesium development server stopped.');
    });

    var isFirstSig = true;
    process.on('SIGINT', function() {
        if (isFirstSig) {
            console.log('Cesium development server shutting down.');
            server.close(function() {
              process.exit(0);
            });
            isFirstSig = false;
        } else {
            console.log('Cesium development server force kill.');
            process.exit(1);
        }
    });




var dgram = require('dgram');
var UDPserver = dgram.createSocket('udp4');

UDPserver.on('listening', function () {
    var address = UDPserver.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

UDPserver.on('message', function (message, remote) {

    var msgArray = String(message).split(',');

		//if(clients[i]!=connection)
		var lat = msgArray[1];
		var lon = msgArray[2];
		var alt = msgArray[3];
		var heading = msgArray[4]*Math.PI/180;
		var pitch = (msgArray[5] - 90)*Math.PI/180;
		var roll = msgArray[6]*Math.PI/180;
        var msgToWSClients = '{"msg-type":"ge-cam", "lon":'+lon+',"lat":'+lat+',"ht":'+alt+',"heading":'+heading+',"pitch":'+pitch+',"roll":'+roll+'}';

    for(var i in wsClients){
		wsClients[i].send(msgToWSClients);		
   	}
    
});

UDPserver.bind(CONFIG.UDP_PORT, CONFIG.UDP_HOST);

})();
