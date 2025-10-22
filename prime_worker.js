/**
 * Project: Prime Number Worker (Worker Thread)
 *
 * This script runs in a separate thread. It listens for a message
 * from the main thread, performs the heavy calculation, and sends
 * the result back. It does *not* handle any HTTP logic.
 */

const { parentPort } = require('worker_threads');

/**
 * A CPU-intensive function to check for primality.
 * This function will block the *worker* thread, but not the main thread.
 * @param {number} num The number to check.
 * @returns {boolean} True if prime, false otherwise.
 */
function isItPrime(num) {
    if (num <= 1) return false;
    if (num === 2) return true;

    // An unoptimized loop to simulate heavy CPU load.
    // We only need to check up to the square root.
    const max = Math.sqrt(num);
    for (let i = 2; i <= max; i++) {
        if (num % i === 0) {
            return false; // Found a divisor
        }
    }
    return true; // No divisors found
}

// --- Worker Logic ---

// 1. Listen for the 'message' event from the main thread.
parentPort.on('message', (number) => {
    console.log(`[Worker Thread] Received number: ${number}. Starting calculation...`);

    // 2. Run the heavy, blocking function.
    const startTime = Date.now();
    const isPrime = isItPrime(number);
    const duration = (Date.now() - startTime) / 1000; // in seconds

    console.log(`[Worker Thread] Calculation done in ${duration}s.`);

    // 3. Send the result back to the main thread.
    parentPort.postMessage({
        number: number,
        isPrime: isPrime,
        durationSeconds: duration
    });
});
