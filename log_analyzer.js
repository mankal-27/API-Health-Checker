/**
 * Project: Log File Analyzer
 *
 * This script demonstrates how to use `child_process.spawn` to run a
 * long-running system command (like `sort`) and stream its output
 * directly to an HTTP client in real-time.
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PORT = 3000;
const LOG_FILE_NAME = 'large_app.log';

/**
 * Creates a large, unsorted dummy log file to analyze.
 * This runs *synchronously* on startup to ensure the file exists.
 */
function createDummyLogFile() {
    console.log(`[SETUP] Checking for '${LOG_FILE_NAME}'...`);
    const logFilePath = path.resolve(__dirname, LOG_FILE_NAME);

    // Don't recreate if it already exists
    if (fs.existsSync(logFilePath)) {
        console.log(`[SETUP] File already exists. Server is ready.`);
        return;
    }

    console.log(`[SETUP] Creating new dummy log file...`);
    // Format: [TIMESTAMP] [LEVEL] [USER_ID] [MESSAGE]
    // We will sort by the 3rd column (USER_ID)
    const logLines = [
        '2025-10-22T12:40:01Z INFO user-005 Login success',
        '2025-10-22T12:39:50Z ERROR user-002 Failed payment',
        '2025-10-22T12:41:10Z INFO user-002 View page',
        '2025-10-22T12:42:15Z DEBUG user-008 API request',
        '2025-10-22T12:43:00Z INFO user-001 Admin login',
        '2025-10-22T12:44:30Z WARN user-005 Rate limit approaching',
        '2025-10-22T12:45:00Z INFO user-003 Logout',
        '2025-10-22T12:46:12Z INFO user-002 Add to cart',
        '2025-10-22T12:47:05Z ERROR user-001 DB connection failed',
        '2025-10-22T12:48:20Z DEBUG user-007 Cache miss'
    ];

    // Make the file large by repeating the lines
    let fileContent = '';
    for (let i = 0; i < 5000; i++) {
        // Shuffle for effect
        fileContent += logLines.sort(() => 0.5 - Math.random()).join('\n') + '\n';
    }

    fs.writeFileSync(logFilePath, fileContent);
    console.log(`[SETUP] '${LOG_FILE_NAME}' created successfully.`);
}

// --- Main HTTP Server ---
const server = http.createServer((req, res) => {

    // --- Homepage Route ---
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(
            `Server is running.
Test the real-time stream by running this in your terminal:
curl http://localhost:3000/analyze
`
        );
        return;
    }

    // --- Log Analyzer Route ---
    if (req.url === '/analyze') {
        const logFilePath = path.resolve(__dirname, LOG_FILE_NAME);

        // Define the system command to run.
        // 'sort -k3' sorts the file by its 3rd column (USER_ID).
        const command = 'sort';
        const args = ['-k3', logFilePath];

        console.log(`[Server] Request received. Spawning command: ${command} ${args.join(' ')}`);

        // 1. Use spawn() to create a child process.
        // This is non-blocking and returns streams for stdio.
        const child = spawn(command, args);

        // 2. Set HTTP headers for a streaming text response
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked'
        });

        // 3. Pipe stdout (Real-time Feedback)
        // This is the magic! We pipe the child's Readable Stream (stdout)
        // directly to the HTTP Writable Stream (res).
        // Node.js handles the data chunks, backpressure, and ending the
        // response stream when the child process finishes.
        child.stdout.pipe(res);

        // 4. Error Handling: OS-level errors
        // This catches errors like "command not found".
        child.on('error', (err) => {
            console.error(`[Server] Failed to start child process: ${err.message}`);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            res.end(`Server Error: ${err.message}`);
        });

        // 5. Error Handling: Command-level errors
        // This catches errors from the command itself (e.g., "file not found").
        child.stderr.on('data', (data) => {
            console.error(`[Process STDERR] ${data.toString()}`);
            // Note: We don't pipe stderr to the client,
            // as it would corrupt the (successful) stdout stream.
        });

        // 6. Logging: Log when the process finishes
        child.on('close', (code) => {
            console.log(`[Server] Child process exited with code ${code}. Stream finished.`);
            // res.end() is called automatically by .pipe()
        });

        return;
    }

    // --- 404 Not Found Route ---
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// --- Start the Server ---
try {
    createDummyLogFile();
    server.listen(PORT, () => {
        console.log('--------------------------------------------------');
        console.log(`✅ Log Analyzer server running at http://localhost:${PORT}/`);
        console.log(`   Test with: curl http://localhost:${PORT}/analyze`);
    });
} catch (error) {
    console.error(`[FATAL] Could not create dummy log file: ${error.message}`);
}
