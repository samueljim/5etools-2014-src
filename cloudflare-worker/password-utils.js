/**
 * Password utilities for D1 database-based source management
 * Replaces the Vercel blob-based password system
 */

/**
 * Password utilities class using D1 database
 */
export class PasswordUtils {
    constructor(db) {
        this.db = db;
    }

    /**
     * Generate a random salt for password hashing
     */
    static generateSalt() {
        // Generate a random 32-byte salt in hex format
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Hash a password with a salt using SHA-256
     */
    static async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Sanitize source name to only allow safe characters
     */
    static sanitizeSourceName(sourceName) {
        return sourceName.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50).toLowerCase();
    }

    /**
     * Get source data from database
     */
    async getSourcePassword(sourceName) {
        try {
            const source = await this.db
                .prepare("SELECT * FROM sources WHERE name = ?")
                .bind(sourceName)
                .first();
            
            return source || null;
        } catch (error) {
            console.error("Error in getSourcePassword:", error);
            return null;
        }
    }

    /**
     * Create a new source with password protection
     */
    async createSource(sourceName, password) {
        try {
            // Check if source already exists
            const existing = await this.getSourcePassword(sourceName);
            if (existing) {
                throw new Error("Source already exists");
            }

            const salt = PasswordUtils.generateSalt();
            const hashedPassword = await PasswordUtils.hashPassword(password, salt);

            const now = new Date().toISOString();
            
            // Insert new source
            await this.db
                .prepare(`
                    INSERT INTO sources (name, password_hash, salt, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `)
                .bind(sourceName, hashedPassword, salt, now, now)
                .run();

            return {
                success: true,
                source: sourceName,
                createdAt: now
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Validate a password against a source
     */
    async validatePassword(sourceName, password) {
        try {
            const sourceData = await this.getSourcePassword(sourceName);
            if (!sourceData) {
                return false; // Source doesn't exist
            }

            const hashedInput = await PasswordUtils.hashPassword(password, sourceData.salt);
            return hashedInput === sourceData.password_hash;
        } catch (error) {
            console.error("Error validating password:", error);
            return false;
        }
    }

    /**
     * List all sources with basic statistics
     */
    async listSources() {
        try {
            const { results } = await this.db
                .prepare(`
                    SELECT 
                        s.name,
                        s.created_at,
                        COUNT(c.id) as character_count,
                        MAX(c.updated_at) as last_character_update
                    FROM sources s
                    LEFT JOIN characters c ON s.name = c.source_name
                    GROUP BY s.name, s.created_at
                    ORDER BY character_count DESC, s.name ASC
                `)
                .all();
            
            return results;
        } catch (error) {
            console.error("Error listing sources:", error);
            return [];
        }
    }

    /**
     * Update a source password (requires old password)
     */
    async updateSourcePassword(sourceName, oldPassword, newPassword) {
        try {
            // Validate old password first
            const isValidOldPassword = await this.validatePassword(sourceName, oldPassword);
            if (!isValidOldPassword) {
                throw new Error("Invalid current password");
            }

            // Generate new hash
            const salt = PasswordUtils.generateSalt();
            const hashedPassword = await PasswordUtils.hashPassword(newPassword, salt);

            // Update in database
            await this.db
                .prepare(`
                    UPDATE sources 
                    SET password_hash = ?, salt = ?, updated_at = ?
                    WHERE name = ?
                `)
                .bind(hashedPassword, salt, new Date().toISOString(), sourceName)
                .run();

            return {
                success: true,
                message: "Password updated successfully"
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete a source and all its characters (requires password)
     */
    async deleteSource(sourceName, password) {
        try {
            // Validate password first
            const isValidPassword = await this.validatePassword(sourceName, password);
            if (!isValidPassword) {
                throw new Error("Invalid password");
            }

            // Delete source (cascade will handle characters)
            const result = await this.db
                .prepare("DELETE FROM sources WHERE name = ?")
                .bind(sourceName)
                .run();

            if (result.changes === 0) {
                throw new Error("Source not found");
            }

            return {
                success: true,
                message: `Source '${sourceName}' and all its characters have been deleted`
            };
        } catch (error) {
            throw error;
        }
    }
}

/**
 * Source API handlers
 */

/**
 * CORS headers for API responses
 */
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cache-Control, Pragma, Expires",
    "Access-Control-Allow-Credentials": "true"
};

/**
 * Handle preflight CORS requests
 */
function handleOptions() {
    return new Response(null, {
        status: 200,
        headers: CORS_HEADERS
    });
}

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS
        }
    });
}

/**
 * Create a new source
 * POST /api/sources/create
 */
export async function handleSourceCreate(request, env) {
    if (request.method === "OPTIONS") return handleOptions();
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const { source, password } = await request.json();

        // Validate input
        if (!source || !password) {
            return jsonResponse({
                success: false,
                error: "Source name and password are required"
            }, 400);
        }

        // Sanitize source name
        const sanitizedSource = PasswordUtils.sanitizeSourceName(source);
        if (!sanitizedSource || sanitizedSource.length === 0) {
            return jsonResponse({
                success: false,
                error: "Invalid source name. Use only letters, numbers, underscores, and hyphens."
            }, 400);
        }

        if (password.length < 1) {
            return jsonResponse({
                success: false,
                error: "Password cannot be empty"
            }, 400);
        }

        // Create the source
        const passwordUtils = new PasswordUtils(env.DB);
        const result = await passwordUtils.createSource(sanitizedSource, password);

        return jsonResponse({
            success: true,
            message: "Source created successfully",
            source: result.source,
            createdAt: result.createdAt
        });

    } catch (error) {
        console.error("Create source error:", error);

        if (error.message === "Source already exists") {
            return jsonResponse({
                success: false,
                error: "Source already exists. Choose a different name."
            }, 409);
        }

        return jsonResponse({
            success: false,
            error: "Failed to create source"
        }, 500);
    }
}

/**
 * List all sources
 * GET /api/sources/list
 */
export async function handleSourceList(request, env) {
    if (request.method === "OPTIONS") return handleOptions();
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const passwordUtils = new PasswordUtils(env.DB);
        const sources = await passwordUtils.listSources();

        return jsonResponse({
            success: true,
            message: "Sources retrieved successfully",
            sources: sources,
            count: sources.length
        });

    } catch (error) {
        console.error("List sources error:", error);
        return jsonResponse({
            error: "Failed to list sources",
            details: error.message
        }, 500);
    }
}

/**
 * Validate source password
 * POST /api/sources/validate
 */
export async function handleSourceValidate(request, env) {
    if (request.method === "OPTIONS") return handleOptions();
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const { source, password } = await request.json();

        if (!source || !password) {
            return jsonResponse({
                success: false,
                error: "Source name and password are required"
            }, 400);
        }

        const sanitizedSource = PasswordUtils.sanitizeSourceName(source);
        const passwordUtils = new PasswordUtils(env.DB);
        const isValid = await passwordUtils.validatePassword(sanitizedSource, password);

        return jsonResponse({
            success: true,
            valid: isValid,
            source: sanitizedSource
        });

    } catch (error) {
        console.error("Validate source error:", error);
        return jsonResponse({
            error: "Failed to validate source",
            details: error.message
        }, 500);
    }
}

/**
 * Route source API requests based on path
 */
export async function handleSourceAPI(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/create")) {
        return handleSourceCreate(request, env);
    } else if (path.endsWith("/list")) {
        return handleSourceList(request, env);
    } else if (path.endsWith("/validate")) {
        return handleSourceValidate(request, env);
    } else {
        return jsonResponse({
            error: "Not found",
            availableEndpoints: ["/create", "/list", "/validate"]
        }, 404);
    }
}