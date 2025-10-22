// server.js
const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs'); // We need the sync part for HTTPS options
const fsp = require('fs').promises; // NEW: Concept 4 - File System (Promises)
const https = require('https');
const { Worker } = require('worker_threads');
const { exec } = require('child_process'); // NEW: Concept 12 - Child Process
const assert = require('assert');         // NEW: Concept 10 - Assert

const PORT = process.env.PORT || 8443;
const numCPUs = os.cpus().length;

// NEW: Define a directory for our reports
const REPORTS_DIR = path.join(__dirname, 'reports');

// --- Cluster Master Logic (Unchanged) ---
if (cluster.isPrimary) {
    console.log(`[Master ${process.pid}] is running.`);
    console.log(`[Master] Forking ${numCPUs} worker(s)...`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.error(`[Master] Worker ${worker.process.pid} died. Forking a new one...`);
        cluster.fork();
    });

} else {
    // --- Cluster Worker Logic (Updated) ---

    const httpsOptions = {
        // Use synchronous fs here, as it's part of server setup
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
    };

    const server = https.createServer(httpsOptions, (req, res) => {
        console.log(`[Cluster Worker ${process.pid}] Handling ${req.method} ${req.url}`);

        if (req.url === '/upload' && req.method === 'POST') {

            const logProcessorWorker = new Worker(path.join(__dirname, 'log-processor.js'));

            req.on('data', (chunk) => {
                logProcessorWorker.postMessage({ type: 'chunk', data: chunk });
            });

            req.on('end', () => {
                logProcessorWorker.postMessage({ type: 'end' });
            });

            // --- NEW: Report Handling Logic ---
            // Make this listener async to use await for file I/O
            logProcessorWorker.on('message', async (report) => {
                console.log(`[Cluster Worker ${process.pid}] Report received from worker thread.`);

                try {
                    // 1. VALIDATE (Concept 10: assert)
                    assert.ok(report.status === 'success', 'Worker report status not success');
                    assert.strictEqual(typeof report.finalHash, 'string', 'Invalid hash type');
                    assert.ok(report.finalHash.length > 10, 'Invalid hash length'); // Basic sanity check
                    assert.strictEqual(typeof report.lineCount, 'number', 'Invalid lineCount type');

                    // 2. STORE (Concept 4: fs.promises)
                    const reportFileName = `${report.finalHash}.json`;
                    const reportPath = path.join(REPORTS_DIR, reportFileName);
                    const reportContent = JSON.stringify(report, null, 2);

                    // Ensure directory exists (non-blocking)
                    await fsp.mkdir(REPORTS_DIR, { recursive: true });
                    // Write the file (non-blocking)
                    await fsp.writeFile(reportPath, reportContent);

                    console.log(`[Cluster Worker ${process.pid}] Report saved to ${reportPath}`);

                    // 3. RESPOND
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ...report, reportPath }));

                } catch (err) {
                    // Concept 9: Handle validation or file I/O errors
                    console.error(`[Cluster Worker ${process.pid}] Failed to process report:`, err.message);
                    let statusCode = 500;
                    if (err instanceof assert.AssertionError) {
                        statusCode = 400; // Bad data from worker
                    }
                    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
                    res.end(`Failed to process report: ${err.message}`);
                }
            });

            // --- Error Handling (Unchanged) ---
            req.on('error', (err) => {
                console.error(`[Cluster Worker ${process.pid}] Request stream error:`, err);
                logProcessorWorker.terminate();
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Request stream error.');
            });

            logProcessorWorker.on('error', (err) => {
                console.error(`[Cluster Worker ${process.pid}] Worker thread error:`, err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Processing error.');
            });

            // --- NEW: Archive Endpoint ---
        } else if (req.url === '/archive' && req.method === 'GET') {
            console.log(`[Cluster Worker ${process.pid}] Archiving reports...`);
            const archivePath = path.join(__dirname, 'reports.tar.gz');

            // Concept 12: Use 'tar' (common on Linux/macOS) to create a gzipped archive
            // -C changes directory to REPORTS_DIR and '.' archives its contents
            const command = `tar -czf ${archivePath} -C ${REPORTS_DIR} .`;

            exec(command, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[Cluster Worker ${process.pid}] Archive failed:`, stderr);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`Archiving failed: ${stderr}`);
                    return;
                }
                console.log(`[Cluster Worker ${process.pid}] Archive created at ${archivePath}`);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(`Archive created successfully at ${archivePath}\n`);
            });

        } else {
            // Update 404 message to include new endpoint
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found. Please POST to /upload or GET /archive\n');
        }
    });

    server.on('error', (err) => {
        console.error(`[Cluster Worker ${process.pid}] Server error:`, err.message);
    });

    server.listen(PORT, () => {
        console.log(`[Cluster Worker ${process.pid}] Server listening on https://localhost:${PORT}`);
    });
}