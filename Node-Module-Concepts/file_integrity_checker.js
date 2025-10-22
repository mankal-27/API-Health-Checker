/**
 * Project: File Integrity Checker
 *
 * This utility calculates the SHA256 hash of a file by piping the
 * file's readable stream directly into the crypto hash stream.
 *
 * Usage: node file_integrity_checker.js <path/to/your/file>
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// --- Configuration ---
const DUMMY_FILENAME = 'test_image.jpg'; // Using a common extension for demonstration
const HASH_ALGORITHM = 'sha256';

// --- Setup: Create a dummy file if no argument is provided ---

/**
 * Creates a small dummy file to ensure the script is runnable immediately.
 * @returns {void}
 */
function createDummyFile() {
    if (!fs.existsSync(DUMMY_FILENAME)) {
        console.log(`[SETUP] Creating dummy file: ${DUMMY_FILENAME}`);
        // This content is arbitrary and just ensures the file exists and has data.
        const content = "This is a simple text file acting as a test image. Changing this content will change the hash.";
        fs.writeFileSync(DUMMY_FILENAME, content, 'utf8');
    }
}

// --- Main Hashing Logic ---

/**
 * Calculates the hash of a given file path using streams.
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the hexadecimal hash string.
 */
function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        // 1. Create a readable stream for the file
        const readStream = fs.createReadStream(filePath);

        // 2. Create the hash transform stream
        const hash = crypto.createHash(HASH_ALGORITHM);

        // 3. Pipe the file stream directly into the hash stream
        // Data chunks flow from readStream -> hash
        readStream
            .pipe(hash)
            .on('finish', () => {
                // The hash stream finishes only after all data has been piped and processed
                const finalHash = hash.digest('hex');
                resolve(finalHash);
            })
            .on('error', (err) => {
                // Handle read errors (e.g., file not found)
                reject(err);
            });
    });
}

// --- Execution ---

async function main() {
    let targetFilePath = process.argv[2];

    // If no path is provided, use the dummy file and create it
    if (!targetFilePath) {
        createDummyFile();
        targetFilePath = DUMMY_FILENAME;
        console.log(`[INFO] No file path provided. Using dummy file: ${targetFilePath}`);
    }

    // Resolve the path to absolute for clarity
    const absolutePath = path.resolve(targetFilePath);

    if (!fs.existsSync(absolutePath)) {
        console.error(`\n❌ ERROR: File not found at path: ${absolutePath}`);
        console.log(`Usage: node ${path.basename(__filename)} <path/to/file>`);
        return;
    }

    console.log(`\n🔍 Checking integrity for: ${absolutePath}`);
    console.log(`Method: ${HASH_ALGORITHM} hashing via streams.`);

    try {
        const hashValue = await calculateFileHash(absolutePath);

        // Read file size for extra context
        const stats = await fs.promises.stat(absolutePath);
        const sizeKB = (stats.size / 1024).toFixed(2);

        console.log('\n--- Integrity Check Complete ---');
        console.log(`File Size: ${sizeKB} KB`);
        console.log(`SHA256 Hash: \n${hashValue}`);
        console.log('------------------------------');

    } catch (error) {
        console.error(`\n❌ Failed to calculate hash: ${error.message}`);
    }
}

main();
