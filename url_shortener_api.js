/**
 * Project: Barebones URL Shortener API
 *
 * This script creates a simple HTTP server using the native 'http' module.
 * It demonstrates:
 * 1. Handling different HTTP methods (POST, GET).
 * 2. Reading request bodies using the stream 'data' and 'end' events.
 * 3. Implementing a basic in-memory data store (Map).
 * 4. Sending JSON responses and HTTP redirects (302).
 */

const http = require('http');
const url = require('url');

// --- Configuration ---
const PORT = 3000;
// In-memory storage: Map<shortCode, longURL>
const urlMap = new Map();

// --- Utility Functions ---

/**
 * Generates a simple 6-character short code.
 * @returns {string} The short code.
 */
function generateShortCode() {
    return Math.random().toString(36).substring(2, 8);
}

/**
 * Sends a structured JSON response to the client.
 * @param {http.ServerResponse} res - The response object.
 * @param {number} statusCode - The HTTP status code (e.g., 200, 400).
 * @param {Object} data - The JavaScript object to be serialized as JSON.
 */
function sendJsonResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        // Simple CORS header for testing ease
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}


// --- Request Handlers ---

/**
 * Handles POST requests to /shorten to create a new short URL.
 * @param {http.ClientRequest} req - The request stream (EventEmitter).
 * @param {http.ServerResponse} res - The response object.
 */
function handleShorten(req, res) {
    let body = '';

    // 1. Listen for the 'data' event: Stream the request body chunk by chunk
    req.on('data', chunk => {
        body += chunk.toString(); // Convert Buffer to string
    });

    // 2. Listen for the 'end' event: The entire request body has been received
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const originalUrl = data.url;

            if (!originalUrl) {
                return sendJsonResponse(res, 400, {
                    error: 'URL property is required in the request body.'
                });
            }

            // Simple validation: check if it looks like a URL
            if (!originalUrl.startsWith('http')) {
                return sendJsonResponse(res, 400, {
                    error: 'Invalid URL format. Must start with http:// or https://'
                });
            }

            const shortCode = generateShortCode();
            urlMap.set(shortCode, originalUrl);

            // Respond with the newly created short URL
            const shortUrl = `http://localhost:${PORT}/${shortCode}`;
            console.log(`[CREATE] New URL shortened: ${originalUrl} -> ${shortCode}`);
            sendJsonResponse(res, 201, {
                originalUrl: originalUrl,
                shortCode: shortCode,
                shortUrl: shortUrl
            });

        } catch (error) {
            // Catches errors from JSON.parse
            sendJsonResponse(res, 400, {
                error: 'Invalid JSON format in request body.'
            });
        }
    });

    // 3. Listen for the 'error' event: Handle connection or parsing errors
    req.on('error', (err) => {
        console.error('Request error:', err);
        sendJsonResponse(res, 500, { error: 'Internal server error during request processing.' });
    });
}

/**
 * Handles GET requests to /:code for redirection.
 * @param {http.ServerResponse} res - The response object.
 * @param {string} code - The short code extracted from the URL path.
 */
function handleRedirect(res, code) {
    const originalUrl = urlMap.get(code);

    if (originalUrl) {
        // Use writeHead to send the redirect status and Location header
        res.writeHead(302, {
            'Location': originalUrl
        });
        res.end(); // End the response immediately
        console.log(`[REDIRECT] Code ${code} redirected to ${originalUrl}`);
    } else {
        sendJsonResponse(res, 404, {
            error: `Short code '${code}' not found.`
        });
    }
}


// --- Server Creation ---

// http.createServer implicitly uses EventEmitter for its events (like 'request')
const server = http.createServer((req, res) => {
    // 1. Parse the URL and path
    const parsedUrl = url.parse(req.url, true);
    const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);
    const method = req.method;

    // 2. Routing Logic
    if (method === 'POST' && pathSegments[0] === 'shorten') {
        handleShorten(req, res);
    } else if (method === 'GET' && pathSegments.length === 1) {
        // Matches requests like /abcde
        const shortCode = pathSegments[0];
        handleRedirect(res, shortCode);
    } else {
        sendJsonResponse(res, 404, {
            error: 'Endpoint not found or method not supported.'
        });
    }
});

// Start the server listening
server.listen(PORT, () => {
    console.log(`\n✅ URL Shortener API running at http://localhost:${PORT}`);
    console.log('--- Test Endpoints ---');
    console.log(`1. POST /shorten (Send raw JSON body: {"url": "https://www.google.com"})`);
    console.log('2. GET /:code (Once you have a code, try navigating to it)');
    console.log('----------------------');
});
