const { worker } = require('worker_threads');
const worker = new Worker('worker_threads.js');

worker.on('message', (result) => {
    console.log('Main Thread received: ', result);
});

// Sends data to the worker
worker.postMessage({ number: 40 });

console.log('Main Thread continues to handle web requests....')

//Worker_thread.js
const { parentPort } = require('worker_threads');

parentPort.on('message', (data) => {
    // Perform a heavy, blocking calculation
    const result = heavyCalculation(data.number);

    //Send the result back to the main thread
    parentPort.postMessage(result);
});