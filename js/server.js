#!/usr/bin/env node

/**
 * @type {any}
 */
const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const wss = new WebSocket.Server({noServer: true});
const setupWSConnection = require('./utils.js').setupWSConnection;

const port = process.env.PORT || 1234;
const options = {
	cert: fs.readFileSync(
		'/etc/letsencrypt/live/cress.soc.surrey.ac.uk/fullchain.pem'
	),
	key: fs.readFileSync(
		'/etc/letsencrypt/live/cress.soc.surrey.ac.uk/privkey.pem'
	),
};

const server = https.createServer(options, (request, response) => {
	response.writeHead(200, {'Content-Type': 'text/plain'});
	response.end('okay');
});

wss.on('connection', setupWSConnection);

server.on('upgrade', (request, socket, head) => {
	// You may check auth of request here..
	/**
	 * @param {any} ws
	 */
	const handleAuth = (ws) => {
		wss.emit('connection', ws, request);
	};
	wss.handleUpgrade(request, socket, head, handleAuth);
});

server.listen(port);

console.log('running on port', port);