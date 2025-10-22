/**
 * Project: Clustered API with Simulated Load
 *
 * This single file demonstrates the `cluster` module.
 * - If `cluster.isPrimary` is true, this file acts as the "manager"
 * and forks a new "worker" process for each CPU core.
 * - If `cluster.isPrimary` is false (meaning `cluster.isWorker` is true),
 * this file acts as the actual HTTP server.
 *
 * This allows Node.js to bypass the single-thread limit by running
 * multiple processes, all sharing the same port.
 */

const cluster = require('cluster');
const http = require('http');
const os = require('os');
const process = require('process');

const PORT = 3000;
const numCPUs = os.cpus().length;

// --- This is the synchronous, CPU-blocking function ---
// We run this in the request handler to simulate heavy load.
function heavySyncTask() {
    // This loop will take 1-2 seconds and block the *entire*
    // event loop of *this specific worker*.
    let total = 0;
    // 5e8 is 500,000,000
    for (let i = 0; i < 5e8; i++) {
        total += i;
    }
    return total;
}

// =================================================================
// PRIMARY (MANAGER) LOGIC
// =================================================================
if (cluster.isPrimary) {
    console.log(`[Primary] Primary Process PID: ${process.pid}`);
    console.log(`[Primary] Machine has ${numCPUs} CPU cores.`);
    console.log(`[Primary] Forking ${numCPUs} worker processes...`);

    // Fork a worker process for each CPU core
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // --- Resilience: Listen for worker deaths ---
    // If a worker dies, log it and start a new one to replace it.
    cluster.on('exit', (worker, code, signal) => {
        console.error(`[Primary] Worker PID ${worker.process.pid} died with code ${code}.`);
        console.log('[Primary] Forking a new worker to replace it...');
        cluster.fork();
    });

    cluster.on('listening', (worker, address) => {
        console.log(`[Primary] Worker PID ${worker.process.pid} is now connected to http://localhost:${address.port}`);
    });

}
// =================================================================
// WORKER (SERVER) LOGIC
// =================================================================
else {
    // This code block is executed by each forked "worker" process.
    // Each worker runs its own server with its own event loop.

    const server = http.createServer((req, res) => {
        // Only respond to the root URL
        if (req.url === '/') {
            console.log(`[Worker ${process.pid}] Received request. Starting heavy sync task...`);

            // --- Simulate Blocking Load ---
            // This blocks *this worker's* event loop for ~1-2 seconds.
            const startTime = Date.now();
            const taskResult = heavySyncTask();
            const duration = (Date.now() - startTime) / 1000; // in seconds

            console.log(`[Worker ${process.pid}] Task finished in ${duration}s.`);

            // Send the response, including which worker handled it
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: "Request processed after heavy task.",
                workerPid: process.pid,
                durationSeconds: duration,
                taskResult: taskResult
            }));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    // --- Port Sharing ---
    // The magic of the `cluster` module: all worker processes can
    // call .listen() on the *same port*. The primary process
    // manages distributing incoming connections to the workers.
    server.listen(PORT, () => {
        // This log will appear once for each worker
        // console.log(`[Worker ${process.pid}] Server started. Listening on port ${PORT}`);
        // The 'listening' event handler on the primary is more robust
    });
}
