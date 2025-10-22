/**
 * Project: User Authentication Service
 *
 * This script builds a secure API for user sign-up and sign-in.
 * It demonstrates:
 * 1. `crypto.randomBytes()` to generate a unique salt.
 * 2. `crypto.pbkdf2()` (async) to securely hash passwords (key derivation).
 * 3. `assert.strictEqual()` in a try/catch block to verify passwords.
 * 4. A mock in-memory database (Map) to store user credentials.
 */

const http = require('http');
const crypto = require('crypto');
const assert = require('assert');
const { URL } = require('url');

// --- Cryptographic Constants ---
// These values determine the "work factor" or cost of the hash.
// Higher values are more secure but slower.
const HASH_ITERATIONS = 100000; // Recommended minimum
const HASH_KEY_LENGTH = 64;     // 64 bytes for SHA-512
const HASH_DIGEST = 'sha512';   // Use a modern digest
const SALT_BYTES = 16;          // 16 bytes is standard

// --- Mock In-Memory Database ---
// In a real app, this would be a database (e.g., PostgreSQL, MongoDB).
// We store: username -> { salt: '...', hash: '...' }
const userDatabase = new Map();

// --- Helper: Promisify pbkdf2 ---
// We wrap the callback-based pbkdf2 in a Promise for modern async/await syntax.
function pbkdf2Async(password, salt, iterations, keylen, digest) {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey.toString('hex'));
        });
    });
}

// --- Helper: Read JSON Request Body ---
function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', err => {
            reject(err);
        });
    });
}

// --- Helper: Send JSON Response ---
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

/**
 * Main HTTP Server Request Handler
 */
const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    try {
        // --- 1. SIGN-UP Endpoint ---
        // Creates a new user with a salted, hashed password.
        if (pathname === '/signup' && req.method === 'POST') {
            const { username, password } = await getBody(req);

            if (!username || !password) {
                return sendJSON(res, 400, { error: 'Username and password are required.' });
            }
            if (userDatabase.has(username)) {
                return sendJSON(res, 409, { error: 'User already exists.' });
            }

            // 1. Generate a unique salt for this user
            const salt = crypto.randomBytes(SALT_BYTES).toString('hex');

            // 2. Hash the password with the salt (non-blocking)
            console.log(`[Auth] Hashing password for ${username}... (this is slow)`);
            const hash = await pbkdf2Async(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST);
            console.log(`[Auth] Hashing complete for ${username}.`);

            // 3. Store the user, salt, and hash
            userDatabase.set(username, { salt, hash });

            return sendJSON(res, 201, { status: 'User created successfully.' });
        }

        // --- 2. SIGN-IN Endpoint ---
        // Verifies a user's password against the stored hash.
        if (pathname === '/signin' && req.method === 'POST') {
            const { username, password } = await getBody(req);

            const user = userDatabase.get(username);
            if (!user) {
                return sendJSON(res, 404, { error: 'Invalid username or password.' });
            }

            // 1. Retrieve the user's *specific* salt and stored hash
            const { salt, hash: storedHash } = user;

            // 2. Generate a new hash using the *same* password and *same* salt
            console.log(`[Auth] Verifying password for ${username}... (also slow)`);
            const newHash = await pbkdf2Async(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST);
            console.log(`[Auth] Verification hash generated for ${username}.`);

            // 3. Verification
            // We use assert.strictEqual in a try/catch block.
            // If the hashes don't match, it throws an error.
            try {
                // NOTE: In production, use crypto.timingSafeEqual to prevent
                // timing attacks. assert.strictEqual is used here to
                // specifically demonstrate the project's requirements.
                assert.strictEqual(newHash, storedHash, 'Password verification failed.');

                // If assert *does not* throw, the hashes match.
                return sendJSON(res, 200, { status: 'Login successful!', user });

            } catch (err) {
                // If assert *does* throw, the hashes do not match.
                console.warn(`[Auth] Failed login attempt for: ${username}`);
                return sendJSON(res, 401, { error: 'Invalid username or password.' });
            }
        }

        // --- Homepage / 404 ---
        if (pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Auth API is running. POST to /signup or /signin');
        } else {
            sendJSON(res, 404, { error: 'Not Found' });
        }

    } catch (e) {
        console.error(`[Server] Global error: ${e.message}`);
        if (!res.headersSent) {
            sendJSON(res, 500, { error: e.message || 'Internal Server Error' });
        }
    }
});

// --- Start the Server ---
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`✅ Secure Auth API running at http://localhost:${PORT}/`);
});
