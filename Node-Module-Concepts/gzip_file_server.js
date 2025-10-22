/**
 * Project: GZip File Server (Streams Demo)
 *
 * This script demonstrates the power of Node.js streams by piping a
 * readable file stream through a transform compression stream (Gzip)
 * directly into the writable HTTP response stream, ensuring low memory usage.
 */

const http = require('http');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const FILENAME = process.env.FILENAME || 'sample_text_file.txt';

// --- Setup: Create a large Dummy file for streaming ---

/**
 * Create a large text file if it doesn't already exist.
 */
function createDummyFile() {
    if (!fs.existsSync(FILENAME)) {
        console.log(`[SETUP] Creating large Dummy file: ${FILENAME}`);
        const content = "This is a line of repeating text to simulate a large Dummy file.";
        let largeContent = '';
        for (let i = 0; i < 5000; i++) {
            largeContent += `${i + 1}. ${content}\n`;
        }
        fs.writeFileSync(FILENAME, largeContent, 'utf8');
        console.log(`[SETUP] File created successfully (approx. ${largeContent.length / 1000} KB).`);
    }else {
        console.log(`[SETUP] Dummy file ${FILENAME} already exists.`);
    }
}

// --- Main Server Logic ---

const server = http.createServer((req, res) => {
    if(req.url !== '/' || req.method !== 'GET') {
        res.writeHead(404, {'content-type': 'text/plain'});
        return res.end('Not Found. Access only /')
    }
    console.log(`\n[REQUEST] Received request for ${FILENAME}. Compressing on the fly...`);

    // 1. Set the necessary headers for the client
    // 'Content-Encoding: gzip' tells the browser it needs to decompress the response.
    // 'Content-Type' tells the browser the underlying content type after decompression.
    res.writeHead(200,{
        'Content-Type': 'text/plain',
        'Content-Encoding': 'gzip'
    });

    try {
        // 2. Create the Readable Stream(source)
        const readStream = fs.createReadStream(FILENAME);

        //3. Create the Transform Stream (middleman)
        const gzipStream = zlib.createGzip();

        //4. Start Piping(Chain the Streams)
        // Data Flows non-blockingly;
        // readStream -> gzipStream -> res (Writable Stream)
        readStream
        .pipe(gzipStream) // Gzip compress chunks as they arrive
            .pipe(res); // The Http response sends compressed chunks to the client

        // Handle potential error on the read stream
        readStream.on('error', (err) => {
            console.error('[ERROR] Read stream failed: ', err.message);
            if(!res.headersSent){
                res.writeHead(500, {'content-type': 'text/plain'});
                res.end('Internal Server Error: Could not find/read any file.');
            }
        });

        //Handle Successful completion
        readStream.on('end', () => {
            console.log('[STREAM] Read stream finished. Compression and sending complete.');
        })

    }catch(err) {
        console.error('[ERROR] Failed to set up streams:', err.message);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error.');
        }
    }
});

// --- Intialization ---
createDummyFile();

server.listen(PORT, () => {
    console.log(`\n✅ GZip File Server running at http://localhost:${PORT}`);
    console.log('Open this link in your browser. The browser will automatically decompress the file!');
});

// Optional: Graceful shutdown on process exit
process.on('SIGINT', () => {
    console.log('\nServer shutting down...');
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
});