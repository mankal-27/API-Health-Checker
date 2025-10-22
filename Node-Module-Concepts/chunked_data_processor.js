/**
 * Intermediate Event Emitter Project: Chunked Data Processor
 *
 * This demonstrates:
 * 1. Extending EventEmitter for custom components.
 * 2. Using recursive setTimeout to simulate non-blocking, chunked I/O.
 * 3. Emitting different events ('progress', 'error', 'finished') for status updates.
 */

const EventEmitter = require('events');

/**
 * Simulates processing a large number of data items in small, non-blocking chunks.
 * This pattern keeps the Event Loop free to handle other tasks (like network traffic).
 */
class DataProcessor extends EventEmitter {
    constructor() {
        super();
        this.processedCount = 0;
        this.totalCount = 0;
    }

    /**
     * Starts the simulated data processing sequence.
     * @param {number} totalItems - The total number of items to process.
     */
    startProcessing(totalItems) {
        this.totalCount = totalItems;
        this.processedCount = 0;
        console.log(`\nProcessor started. Total items to process: ${this.totalCount}`);

        // Start the recursive, non-blocking process
        this._processNextChunk();
    }

    /**
     * The recursive function that schedules the next chunk of work.
     * This is the core of the non-blocking simulation.
     */
    _processNextChunk() {
        // --- 1. Simulate Work (Synchronous, but brief) ---
        // We simulate processing a single item per call.
        this.processedCount++;

        const progress = Math.round((this.processedCount / this.totalCount) * 100);

        // --- 2. Error Simulation ---
        if (this.processedCount === 5) {
            // Emits an 'error' event and halts processing.
            // Note: If no 'error' listener is present, Node.js will crash!
            this.emit('error', new Error(`Processing failed at item ${this.processedCount} due to simulated server connection loss.`));
            return; // Stop the recursion
        }

        // --- 3. Progress Event Emission ---
        if (this.processedCount % 2 === 0 || this.processedCount === 1) {
            // Emit progress event every few items (or on the first)
            this.emit('progress', {
                items: this.processedCount,
                percent: progress
            });
        }


        // --- 4. Scheduling the Next Chunk (Non-blocking) ---
        if (this.processedCount < this.totalCount) {
            // The magic: schedule the next function call using setTimeout(0).
            // This tells the Event Loop: "Run this function as soon as the current JS execution queue is empty."
            // This is how we avoid blocking the main thread.
            setTimeout(() => this._processNextChunk(), 0);
        } else {
            // --- 5. Completion Event Emission ---
            this.emit('finished', {
                totalItems: this.totalCount,
                duration: 'Simulated 50ms total' // In a real app, this would be Date.now()
            });
        }
    }
}

// --- Application Demonstration ---

const processor = new DataProcessor();

// Listener 1: The 'progress' listener (handles frequent updates)
processor.on('progress', (status) => {
    // This is run whenever _processNextChunk emits 'progress'
    console.log(`[Status Tracker] 🟢 Processing: ${status.percent}% complete (${status.items}/${processor.totalCount} items)`);
});

// Listener 2: The 'finished' listener (handles termination)
processor.on('finished', (summary) => {
    console.log('\n======================================================');
    console.log(`[Report Generator] ✅ FINISHED! Processed ${summary.totalItems} items.`);
    console.log('The report is ready.');
    console.log('======================================================');
});

// Listener 3: The crucial 'error' listener
// A must-have for any EventEmitter to prevent the Node.js process from crashing
// when an 'error' event is emitted.
processor.on('error', (err) => {
    console.error(`\n[CRITICAL ERROR HANDLER] 💥 Pipeline Halted: ${err.message}`);
    console.error('The application caught the error and prevented a crash.');
});


// Start the simulation with 10 items
processor.startProcessing(10);

console.log("\nMAIN THREAD: The processor started. My code continues executing immediately.");
console.log("This line prints BEFORE the processing completes, proving the operation is non-blocking.");
