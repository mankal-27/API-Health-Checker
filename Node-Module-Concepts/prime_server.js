/**
 * Project: Non-Blocking Prime Number Finder (Main Thread)
 *
 * This is the main HTTP server. It accepts requests and offloads
 * the CPU-intensive prime calculation to a separate worker thread
 * to keep the main event loop free and responsive.
 */

const http = require('http');
const { URL } = require('url');
const path = require('path');
const { Worker } = require('worker_threads');

// --- Helper Function ---
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// --- The Main HTTP Server ---
const server = http.createServer((req, res) => {
    // Use the WHATWG URL parser
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // --- ROUTE: / (Homepage with instructions) ---
    if (pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(
            `Server is running and NON-BLOCKED.

Try these two URLs in separate browser tabs:

1. Start a slow calculation (will take ~5-10 seconds):
   /calculate?number=100000000000031

2. Check server responsiveness (while the first tab is still loading):
   /status
`
        );
        return;
    }

    // --- ROUTE: /status (Proves the server is not blocked) ---
    if (pathname === '/status') {
        sendJSON(res, 200, {
            status: 'alive',
            message: 'Main event loop is responsive! 🔥'
        });
        return;
    }

    // --- ROUTE: /calculate (Starts the worker) ---
    if (pathname === '/calculate') {
        const number = parseInt(parsedUrl.searchParams.get('number'), 10);

        if (isNaN(number) || number < 1) {
            return sendJSON(res, 400, { error: 'Invalid number. Please provide a "number" query parameter.' });
        }

        // --- Worker Thread Initiation ---
        // 1. Create a new worker, pointing to the worker script.
        const worker = new Worker(path.resolve(__dirname, 'prime_worker.js'));

        // 2. Listen for the 'message' event from the worker.
        //    The 'res' object is available here thanks to closure.
        worker.on('message', (result) => {
            console.log(`[Main Thread] Worker finished, sending result for ${result.number}`);
            sendJSON(res, 200, { status: 'complete', ...result });
        });

        // 3. Listen for errors.
        worker.on('error', (err) => {
            console.error(`[Main Thread] Worker error: ${err.message}`);
            sendJSON(res, 500, { status: 'error', message: err.message });
        });

        // 4. Send the number to the worker to start the calculation.
        console.log(`[Main Thread] Offloading calculation for ${number} to worker...`);
        worker.postMessage(number);

        // Note: The main request handler function *ends here*.
        // The main thread is now free to handle other requests (like /status).
        // The response to *this* client will be sent later by the worker's
        // 'message' event listener.
        return;
    }

    // --- 404 Not Found ---
    sendJSON(res, 404, { error: 'Not Found' });
});

// --- Start the Server ---
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}/`);
    console.log('   Waiting for calculations...');
});
