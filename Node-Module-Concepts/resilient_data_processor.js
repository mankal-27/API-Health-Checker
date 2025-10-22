/**
 * Project: API Data Fetcher with Retries
 *
 * This script demonstrates resilient asynchronous error handling using:
 * 1. Promise.catch() for structured retry logic.
 * 2. process.on('unhandledRejection') for global error catching.
 * 3. EventEmitter to emit custom 'error' events during processing.
 */

const EventEmitter = require('events');

// --- Global Safety Net: process.on('unhandledRejection') ---
// This acts as the final guard for any Promise rejections that are not
// handled with a local .catch() block anywhere in the application.
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n=============================================');
    console.error('💥 GLOBAL CATCH: Unhandled Promise Rejection! 💥');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    console.error('=============================================\n');
    // NOTE: In production, you might want to log this and potentially exit.
});


// --- 1. Fetcher Module (Simulates network requests with random failures) ---

/**
 * Simulates an API fetch request that randomly succeeds or fails.
 * @returns {Promise<any>} A promise that resolves with data or rejects on failure.
 */
function mockApiFetcher() {
    return new Promise((resolve, reject) => {
        // Simulate network latency
        setTimeout(() => {
            // 60% chance of failure (rejection)
            if (Math.random() < 0.6) {
                reject(new Error("Network connection timed out or rejected."));
            } else {
                // 40% chance of success (resolution)
                // Randomly return "bad" data 20% of the time to trigger the Processor error
                const data = {
                    status: 'success',
                    data: Math.random() < 0.2 ? 'BAD_DATA_FORMAT' : { id: 101, value: Math.floor(Math.random() * 100) }
                };
                resolve(data);
            }
        }, 500);
    });
}

/**
 * Fetches data with built-in retry logic.
 * @param {number} maxRetries - Maximum number of times to attempt the fetch.
 * @param {number} attempt - Current attempt number (internal use).
 * @returns {Promise<any>} The successfully fetched data.
 */
function fetchDataWithRetry(maxRetries, attempt = 1) {
    console.log(`[Fetcher] Attempting data fetch (Attempt ${attempt}/${maxRetries})...`);

    // The core of the retry logic relies on .catch() returning a new promise.
    return mockApiFetcher()
        .then(data => {
            console.log(`[Fetcher] ✅ Success after ${attempt} attempt(s).`);
            return data;
        })
        .catch(error => {
            console.warn(`[Fetcher] ⚠️ Attempt ${attempt} failed: ${error.message}`);
            if (attempt < maxRetries) {
                // If retries remain, wait a moment and try again by returning a new Promise call
                return new Promise(resolve => setTimeout(resolve, 1000))
                    .then(() => fetchDataWithRetry(maxRetries, attempt + 1));
            }
            // If max retries reached, throw the final error to be caught by the caller
            console.error(`[Fetcher] ❌ All ${maxRetries} attempts failed.`);
            throw new Error(`Critical fetch failure after ${maxRetries} retries.`);
        });
}

// --- 2. Custom Event Error (Processor Class) ---

class DataProcessor extends EventEmitter {
    constructor() {
        super();
        this.isValidating = false;
    }

    /**
     * Simulates processing and validation of the fetched data.
     * If validation fails, it emits a custom 'error' event.
     * @param {object} fetchedData - The data received from the fetcher.
     */
    process(fetchedData) {
        this.isValidating = true;
        console.log(`[Processor] Received data, beginning validation...`);

        // Check for the mock 'bad data' format
        if (typeof fetchedData.data === 'string' && fetchedData.data === 'BAD_DATA_FORMAT') {
            const validationError = new Error('Data validation failed: unexpected string format.');
            // Emit the custom error event
            this.emit('error', validationError);
            this.isValidating = false;
            return false;
        }

        // If data is good, proceed
        console.log(`[Processor] ✅ Validation successful. Value is: ${fetchedData.data.value}`);
        this.isValidating = false;
        return true;
    }
}


// --- 3. Main Application Flow ---

async function main() {
    const processor = new DataProcessor();

    // Register listener for custom Processor errors
    processor.on('error', (err) => {
        console.error(`[MAIN SCRIPT] 🚨 Processor Error Handler: ${err.message}`);
        console.log('Action: Halting further processing of this data item.');
    });

    console.log('--- Starting Resilient Data Fetch and Process ---');

    try {
        // Attempt fetch with up to 3 retries
        const data = await fetchDataWithRetry(3);

        // Process the successfully fetched data
        if (data) {
            processor.process(data);
        }

        // --- DEMONSTRATION OF UNHANDLED REJECTION ---
        // This promise intentionally has no .catch() and should be handled by
        // the global process.on('unhandledRejection') handler defined at the top.
        console.log('\n[DEMO] Initiating an intentionally unhandled promise...');
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('This is the unhandled error (Testing Global Safety Net)')), 200);
        });
        // The script continues here while the unhandled promise eventually fails (non-blocking)

    } catch (finalError) {
        // Catches the error if ALL 3 retries fail
        console.error(`[MAIN SCRIPT] 🛑 Final Handler: ${finalError.message}`);
    }

    console.log('[MAIN SCRIPT] Execution continues non-blockingly...');
}

main();
