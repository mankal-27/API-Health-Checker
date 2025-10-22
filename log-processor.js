// log-processor.js
const { parentPort } = require('worker_threads');
const { Readable } = require('stream'); // Concept 6: Streams
const crypto = require('crypto');       // Concept 13: Crypto
const readline = require('readline');   // Concept 14: Readline

console.log(`[Worker Thread ${process.pid}] Spawned.`);

// --- Initialize Processors ---

// 1. Crypto Hasher (handles raw buffers)
const hash = crypto.createHash('sha256');

// 2. Readline Processor (handles lines)
// We create a new Readable stream that readline can consume
const incomingStream = new Readable({
    read() {} // We'll manually push data into this stream
});

// Configure readline
const rl = readline.createInterface({
    input: incomingStream,
    crlfDelay: Infinity // Handle all line-ending types
});

let lineCount = 0;
let errorCount = 0;

rl.on('line', (line) => {
    lineCount++;
    // Perform our "heavy" analysis
    if (line.includes('ERROR') || line.includes('CRITICAL')) {
        errorCount++;
    }
});

rl.on('close', () => {
    console.log(`[Worker Thread] Readline finished. Total lines: ${lineCount}`);
    // This event fires when the stream ends. Now we can report back.
    const finalHash = hash.digest('hex');

    parentPort.postMessage({
        status: 'success',
        finalHash,
        lineCount,
        errorCount
    });
});

// --- Handle Data from Main Thread ---
parentPort.on('message', (message) => {
    if (message.type === 'chunk') {
        // Data is a Buffer, which is what 'hash' and 'stream.push' expect
        hash.update(message.data);
        incomingStream.push(message.data);
    } else if (message.type === 'end') {
        console.log('[Worker Thread] End of stream message received.');
        // Signal to the incomingStream that we're done pushing data
        incomingStream.push(null);
    }
});