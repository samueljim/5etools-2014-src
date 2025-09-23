/**
 * User authentication API handlers
 * Provides registration, login, logout, and session management endpoints
 */

// Helper function to generate a random salt
function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Helper function to hash passwords using Web Crypto API with salt
async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Helper function to generate secure session tokens
function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Helper function to validate session token format
function isValidSessionToken(token) {
    return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);
}

// Helper function to get user from session token
async function getUserFromSession(sessionToken, db) {
    if (!isValidSessionToken(sessionToken)) {
        return null;
    }

    const result = await db.prepare(`
        SELECT u.id, u.username, u.email, u.created_at, u.last_login
        FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.session_token = ? AND s.expires_at > CURRENT_TIMESTAMP
    `).bind(sessionToken).first();

    return result;
}

// Helper function to set CORS headers
function setCORSHeaders(response) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, Cache-Control, Pragma, Expires, DNT, User-Agent, Sec-Ch-Ua, Sec-Ch-Ua-Platform, Sec-Ch-Ua-Mobile, Referer');
    response.headers.set('Access-Control-Expose-Headers', 'X-Session-Token');
    response.headers.set('Access-Control-Max-Age', '3600'); // Cache preflight for 1 hour
    return response;
}

// Handle CORS preflight requests
function handleCORS(request) {
    if (request.method === 'OPTIONS') {
        return setCORSHeaders(new Response(null, { status: 200 }));
    }
    return null;
}

// User registration endpoint
async function handleRegister(request, db) {
    if (request.method !== 'POST') {
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        ));
    }

    try {
        const { username, email, password } = await request.json();

        // Validate input
        if (!username || !email || !password) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Username, email, and password are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        if (username.length < 3 || username.length > 50) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Username must be between 3 and 50 characters' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        if (password.length < 6) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Password must be at least 6 characters long' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Check if user already exists
        const existingUser = await db.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, email).first();

        if (existingUser) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Username or email already exists' }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Generate salt and hash password
        const salt = generateSalt();
        const hashedPassword = await hashPassword(password, salt);
        
        const result = await db.prepare(`
            INSERT INTO users (username, email, password_hash, salt)
            VALUES (?, ?, ?, ?)
        `).bind(username, email, hashedPassword, salt).run();

        if (!result.success) {
            throw new Error('Failed to create user');
        }

        // Create session for the new user
        const sessionToken = generateSessionToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await db.prepare(`
            INSERT INTO user_sessions (user_id, session_token, expires_at)
            VALUES (?, ?, ?)
        `).bind(result.meta.last_row_id, sessionToken, expiresAt.toISOString()).run();

        // Update last login
        await db.prepare(`
            UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(result.meta.last_row_id).run();

        const response = setCORSHeaders(new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: result.meta.last_row_id,
                    username: username,
                    email: email
                }
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        ));

        response.headers.set('X-Session-Token', sessionToken);
        return response;

    } catch (error) {
        console.error('Registration error:', error);
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
}

// User login endpoint
async function handleLogin(request, db) {
    if (request.method !== 'POST') {
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        ));
    }

    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Username and password are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Find user first to get their salt
        const user = await db.prepare(`
            SELECT id, username, email, password_hash, salt, created_at, last_login
            FROM users
            WHERE username = ? OR email = ?
        `).bind(username, username).first();

        if (!user) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Invalid username or password' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Verify password with salt
        const hashedPassword = await hashPassword(password, user.salt);
        if (hashedPassword !== user.password_hash) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Invalid username or password' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Create new session
        const sessionToken = generateSessionToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await db.prepare(`
            INSERT INTO user_sessions (user_id, session_token, expires_at)
            VALUES (?, ?, ?)
        `).bind(user.id, sessionToken, expiresAt.toISOString()).run();

        // Update last login
        await db.prepare(`
            UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(user.id).run();

        const response = setCORSHeaders(new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    created_at: user.created_at,
                    last_login: user.last_login
                }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

        response.headers.set('X-Session-Token', sessionToken);
        return response;

    } catch (error) {
        console.error('Login error:', error);
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
}

// User logout endpoint
async function handleLogout(request, db) {
    if (request.method !== 'POST') {
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        ));
    }

    try {
        const sessionToken = request.headers.get('X-Session-Token') || 
                            request.headers.get('Authorization')?.replace('Bearer ', '');

        if (!sessionToken) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'No session token provided' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        // Delete the session
        await db.prepare(`
            DELETE FROM user_sessions WHERE session_token = ?
        `).bind(sessionToken).run();

        return setCORSHeaders(new Response(
            JSON.stringify({ success: true, message: 'Logged out successfully' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Logout error:', error);
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
}

// Get current user info endpoint
async function handleMe(request, db) {
    if (request.method !== 'GET') {
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        ));
    }

    try {
        const sessionToken = request.headers.get('X-Session-Token') || 
                            request.headers.get('Authorization')?.replace('Bearer ', '');

        if (!sessionToken) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'No session token provided' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const user = await getUserFromSession(sessionToken, db);

        if (!user) {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Invalid or expired session' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        return setCORSHeaders(new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    created_at: user.created_at,
                    last_login: user.last_login
                }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));

    } catch (error) {
        console.error('Get user info error:', error);
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
}

// Main auth API handler
export async function handleAuthAPI(request, env) {
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
        const db = env.DB;

        if (path === '/api/auth/register') {
            return await handleRegister(request, db);
        } else if (path === '/api/auth/login') {
            return await handleLogin(request, db);
        } else if (path === '/api/auth/logout') {
            return await handleLogout(request, db);
        } else if (path === '/api/auth/me') {
            return await handleMe(request, db);
        } else {
            return setCORSHeaders(new Response(
                JSON.stringify({ error: 'Auth endpoint not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            ));
        }

    } catch (error) {
        console.error('Auth API error:', error);
        return setCORSHeaders(new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        ));
    }
}

// Export the helper function for use in other modules
export { getUserFromSession, setCORSHeaders };