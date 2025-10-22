/**
 * Project: Raw TCP Chat/Echo Server
 *
 * This script demonstrates core networking concepts:
 * 1. Non-blocking DNS resolution (dns.lookup).
 * 2. Creating a raw TCP server (net.createServer).
 * 3. The Duplex Stream nature of a net.Socket, used for echoing data.
 */

const net = require('net');
const dns = require('dns');

// --- Configuration ---
const TCP_PORT = process.env.TCP_PORT || 7000;
const EXTERNAL_SERVICE = process.env.EXTERNAL_SERVICE || 'google.com';

// --- Bonus : DNS Lookup on StartUp ---


function checkExternalServiceDNS() {
    console.log(`[SETUP] Verifying IP for external service: ${EXTERNAL_SERVICE}...`);

    // dns.lookup() is non-blocking and uses the operating system's resolver
    dns.lookup(EXTERNAL_SERVICE, (err, address, family) => {
        if (err) {
            console.error(`❌ DNS Lookup failed for ${EXTERNAL_SERVICE}: ${err.message}`);
            return;
        }
        console.log(`✅ External service IP resolved: ${address} (Family: IPv${family})`);
        console.log('--------------------------------------------------');
    });
}

// --- Main TCP Server Logic ---

function startTcpServer() {
    // 1. net.createServer() returns an EventEmitter
    const server = net.createServer((socket) => {
        // The callback receives a net.Socket object, which is a Duplex Stream.
        const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`\n[CONNECTION] Client connected: ${remoteAddress}`);

        // --- Stream/Event Handling ---

        // 2. Listen for the 'data' event (Readable Stream side)
        // Data is always a Buffer object.
        socket.on('data', (data) => {
            const dataString = data.toString().trim();
            console.log(`[RECEIVED from ${remoteAddress}] ${dataString}`);

            // 3. Echo Logic (Writable Stream side)
            // Write the exact same Buffer back to the client.
            socket.write(`ECHO: ${dataString}\n`);
        });

        // Handle connection closure
        socket.on('end', () => {
            console.log(`[DISCONNECT] Client disconnected: ${remoteAddress}`);
        });

        // Handle errors
        socket.on('error', (err) => {
            console.error(`[ERROR] Socket error with ${remoteAddress}: ${err.message}`);
        });
    });

    // Handle server-level errors (e.g., port already in use)
    server.on('error', (err) => {
        console.error(`Server error: ${err.message}`);
    });

    // Start listening on the specified port
    server.listen(TCP_PORT, () => {
        console.log(`\n✅ TCP Echo Server running and listening on port ${TCP_PORT}`);
        console.log('Use a client (like telnet or nc) to connect.');
    });
}

// --- Execution ---
checkExternalServiceDNS();
startTcpServer();
