/**
 * Simple API Health Checker using Node.js timers and environment configuration.
 *
 * How to Run:
 * 1. Ensure you have Node.js installed.
 * 2. Save this code as `api_health_checker.js`.
 * 3. Run the script using one of the following methods:
 *
 * A. Pass URL as command-line argument (Highest priority):
 * node api_health_checker.js https://jsonplaceholder.typicode.com/posts/1
 *
 * B. Set URL and Interval via environment variables:
 * CHECK_INTERVAL_SECONDS=10 API_URL=https://google.com node api_health_checker.js
 *
 * C. Use defaults (URL defaults to a placeholder, interval to 5s):
 * node api_health_checker.js
 */

// --- Configuration Setup ---

// 1. Target URL:
// Check process.argv[2] (command-line argument) first,
// then process.env.API_URL, and finally use a default placeholder.
const targetUrl = process.argv[2] || process.env.API_URL || 'https://httpbin.org/status/200';

if (targetUrl === 'https://httpbin.org/status/200') {
    console.warn("WARN: Using default placeholder URL. Pass a real URL via command line or API_URL environment variable.");
}

// 2. Check Interval:
// Read from process.env.CHECK_INTERVAL_SECONDS, convert to integer,
// and default to 5 seconds if invalid or not set.
const DEFAULT_INTERVAL = 5;
let intervalSeconds = parseInt(process.env.CHECK_INTERVAL_SECONDS, 10);

if (isNaN(intervalSeconds) || intervalSeconds <= 0) {
    intervalSeconds = DEFAULT_INTERVAL;
    console.log(`INFO: Using default check interval of ${intervalSeconds} seconds.`);
} else {
    console.log(`INFO: Using configured check interval of ${intervalSeconds} seconds.`);
}

// Convert seconds to milliseconds for setInterval
const intervalMs = intervalSeconds * 1000;

// --- Core Functionality ---

/**
 * Fetches the target API and logs the health status.
 */
async function checkApiHealth() {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] --- Starting health check for: ${targetUrl} ---`);

    try {
        // Use Node's built-in fetch function (available in modern Node versions)
        const response = await fetch(targetUrl, { method: 'HEAD', timeout: 5000 }); // Use HEAD for efficiency

        if (response.ok) {
            // Success log (HTTP 200-299)
            console.log(`✅ SUCCESS: API is UP. Status: ${response.status} (${response.statusText}).`);
        } else {
            // Failure log (HTTP 4xx or 5xx)
            console.error(`❌ ERROR: API is DOWN. Status: ${response.status} (${response.statusText}).`);
        }
    } catch (error) {
        // Error log (Network error, DNS error, timeout, etc.)
        console.error(`💥 FATAL ERROR: Could not reach API. Details: ${error.message}`);
    }
}

// --- Scheduling ---

console.log(`\nScheduler initialized. The API health check will run every ${intervalSeconds} seconds.`);
console.log("Press Ctrl+C to stop the scheduler.");

// Run the check immediately on startup
checkApiHealth();

// Schedule the check to run repeatedly using setInterval
setInterval(checkApiHealth, intervalMs);
