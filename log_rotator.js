/**
 * Project: Daily Log Rotator
 *
 * This script demonstrates asynchronous file system operations (fs.promises)
 * using async/await for cleaner flow control when managing log files.
 */

// Import fs.promises for the Promise-based API
const fs = require('fs').promises;
const path = require('path');

// --- Configuration ---
const LOG_FILE = 'app.log';
// Days old a log must be before cleanup will delete it
const CLEANUP_THRESHOLD_DAYS = 7;

// --- Helper Functions ---

/**
 * Generates a date string for naming archived logs (YYYY-MM-DD).
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function getFormattedDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Simulates writing a new log entry to the main log file.
 * @param {string} message - The log message to write.
 */
async function writeLog(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} | ${message}\n`;
    try {
        // fs.appendFile automatically creates the file if it doesn't exist
        await fs.appendFile(LOG_FILE, logEntry, 'utf8');
        console.log(`[WRITE] Appended entry to ${LOG_FILE}`);
    } catch (error) {
        console.error(`[ERROR] Failed to write log: ${error.message}`);
    }
}

// --- Main Routines ---

/**
 * Archives the current log file by renaming it with yesterday's date.
 */
async function archiveLogs() {
    console.log('\n--- Starting Log Archival ---');

    // Calculate yesterday's date for the archive filename
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - 1);
    const archiveFileName = `app-${getFormattedDate(archiveDate)}.log`;

    try {
        // 1. Check if the current log file exists
        await fs.access(LOG_FILE);

        // 2. Rename the file
        await fs.rename(LOG_FILE, archiveFileName);
        console.log(`[ARCHIVE] Renamed ${LOG_FILE} to ${archiveFileName}`);

    } catch (error) {
        // fs.access throws an error if the file doesn't exist (code 'ENOENT')
        if (error.code === 'ENOENT') {
            console.log(`[ARCHIVE] ${LOG_FILE} not found. Skipping rename.`);
        } else {
            console.error(`[ERROR] Failed to archive logs: ${error.message}`);
        }
    }
}

/**
 * Cleans up old archived log files based on a date threshold.
 */
async function cleanupOldLogs() {
    console.log('\n--- Starting Log Cleanup ---');

    try {
        // 1. Read all files in the current directory
        const files = await fs.readdir('./');

        const now = new Date();
        let deletedCount = 0;

        for (const file of files) {
            // Check if the file matches the archived log pattern: app-YYYY-MM-DD.log
            const match = file.match(/^app-(\d{4}-\d{2}-\d{2})\.log$/);

            if (match) {
                const dateString = match[1];
                const fileDate = new Date(dateString);
                const timeDifference = now.getTime() - fileDate.getTime();
                const daysDifference = timeDifference / (1000 * 3600 * 24);

                if (daysDifference >= CLEANUP_THRESHOLD_DAYS) {
                    console.log(`[CLEANUP] Reading content of ${file} (to simulate error check)...`);
                    // 2. Read the content (Simulate reading/checking before deletion)
                    const content = await fs.readFile(file, 'utf8');

                    // If we found errors in the content, we might skip deletion, but here we proceed.
                    console.log(`[CLEANUP] Content read successfully. Archival date: ${dateString}. Deleting...`);

                    // 3. Delete the file
                    await fs.unlink(file);
                    deletedCount++;
                    console.log(`[CLEANUP] Deleted old log file: ${file}`);
                }
            }
        }

        if (deletedCount === 0) {
            console.log(`[CLEANUP] No archived logs found older than ${CLEANUP_THRESHOLD_DAYS} days.`);
        }

    } catch (error) {
        console.error(`[ERROR] Failed during cleanup routine: ${error.message}`);
    }
}


/**
 * Main execution function demonstrating the daily rotation and cleanup.
 * Uses a setTimeout sequence to simulate the passage of time/daily trigger.
 */
async function main() {
    console.log('--- Log Rotator Simulation Starting ---');
    console.log(`Logs older than ${CLEANUP_THRESHOLD_DAYS} days will be deleted.`);

    // 1. Write initial logs for today
    await writeLog('Application started successfully.');
    await writeLog('Processing user data...');

    // 2. SIMULATION of Archival (End of Day 1)
    // We create a dummy log file named after 8 days ago so cleanup has something to delete
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 8);
    const oldFileName = `app-${getFormattedDate(oldDate)}.log`;
    await fs.writeFile(oldFileName, "This is an old log that should be deleted.", 'utf8').catch(() => {});
    console.log(`\n[SETUP] Created a file named ${oldFileName} to be cleaned up.`);

    // Use setTimeout to simulate the daily trigger
    setTimeout(async () => {
        console.log('\n=================================================');
        console.log('SIMULATED DAILY ROUTINE TRIGGERED (Day 2)');
        console.log('=================================================');

        // Step A: Archive the current log (app.log -> app-yesterday.log)
        await archiveLogs();

        // Step B: Cleanup any logs older than the threshold
        await cleanupOldLogs();

        console.log('\n--- Simulation Complete ---');

    }, 1000); // 1-second delay to simulate the "next day" trigger
}

main();
