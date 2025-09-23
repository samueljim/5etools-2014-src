/**
 * Migration script to transfer data from Vercel Blob to Cloudflare D1
 * This should be run after setting up the D1 database and deploying the worker
 */

import { list } from "@vercel/blob";

/**
 * Migration class to handle the data transfer
 */
export class VorcelToD1Migration {
    constructor(env) {
        this.env = env;
        this.db = env.DB;
        this.vercelToken = env.VERCEL_BLOB_TOKEN; // You'll need to add this as a secret
    }

    /**
     * Run the complete migration process
     */
    async migrate() {
        console.log("Starting migration from Vercel Blob to D1...");
        
        try {
            // Step 1: Migrate sources (password files)
            console.log("Step 1: Migrating sources...");
            const sourceResults = await this.migrateSources();
            console.log(`Sources migrated: ${sourceResults.success} success, ${sourceResults.errors} errors`);

            // Step 2: Migrate characters
            console.log("Step 2: Migrating characters...");
            const characterResults = await this.migrateCharacters();
            console.log(`Characters migrated: ${characterResults.success} success, ${characterResults.errors} errors`);

            const summary = {
                success: true,
                message: "Migration completed successfully",
                sources: sourceResults,
                characters: characterResults,
                timestamp: new Date().toISOString()
            };

            console.log("Migration summary:", summary);
            return summary;

        } catch (error) {
            console.error("Migration failed:", error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Migrate password files from Vercel Blob to D1 sources table
     */
    async migrateSources() {
        const results = { success: 0, errors: 0, errorDetails: [] };

        try {
            if (!this.vercelToken) {
                throw new Error("VERCEL_BLOB_TOKEN not configured");
            }

            // List all password files from Vercel Blob
            const { blobs } = await list({
                prefix: "passwords/",
                limit: 1000,
                token: this.vercelToken,
            });

            console.log(`Found ${blobs.length} password files to migrate`);

            for (const blob of blobs) {
                try {
                    if (!blob.pathname.endsWith('.json')) continue;

                    // Fetch the password data from blob
                    const response = await fetch(blob.url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch blob: ${response.statusText}`);
                    }

                    const passwordData = await response.json();
                    
                    // Insert into D1 sources table
                    await this.db.prepare(`
                        INSERT OR REPLACE INTO sources (name, password_hash, salt, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(
                        passwordData.source,
                        passwordData.passwordHash,
                        passwordData.salt,
                        passwordData.createdAt,
                        passwordData.lastModified || passwordData.createdAt
                    ).run();

                    results.success++;
                    console.log(`Migrated source: ${passwordData.source}`);

                } catch (error) {
                    results.errors++;
                    results.errorDetails.push({
                        file: blob.pathname,
                        error: error.message
                    });
                    console.error(`Error migrating source ${blob.pathname}:`, error);
                }
            }

        } catch (error) {
            results.errors++;
            results.errorDetails.push({
                stage: "list_sources",
                error: error.message
            });
            console.error("Error listing sources:", error);
        }

        return results;
    }

    /**
     * Migrate character files from Vercel Blob to D1 characters table
     */
    async migrateCharacters() {
        const results = { success: 0, errors: 0, errorDetails: [] };

        try {
            if (!this.vercelToken) {
                throw new Error("VERCEL_BLOB_TOKEN not configured");
            }

            // List all character files from Vercel Blob
            const { blobs } = await list({
                prefix: "characters/",
                limit: 1000,
                token: this.vercelToken,
            });

            console.log(`Found ${blobs.length} character files to migrate`);

            for (const blob of blobs) {
                try {
                    if (!blob.pathname.endsWith('.json')) continue;

                    // Extract character ID from filename
                    const filename = blob.pathname.split("/").pop();
                    const characterId = filename.replace(".json", "");

                    // Fetch the character data from blob
                    const response = await fetch(blob.url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch blob: ${response.statusText}`);
                    }

                    const characterFile = await response.json();
                    
                    // Extract the actual character data (wrapped in { character: [...] })
                    if (!characterFile.character || !Array.isArray(characterFile.character) || characterFile.character.length === 0) {
                        throw new Error("Invalid character file format");
                    }

                    const characterData = characterFile.character[0];
                    
                    // Parse source from character ID (format: name-source)
                    const lastDashIndex = characterId.lastIndexOf('-');
                    if (lastDashIndex === -1) {
                        throw new Error("Invalid character ID format - missing source");
                    }
                    
                    const sourceName = characterId.substring(lastDashIndex + 1);
                    const characterName = characterData.name || "Unknown";

                    // Insert into D1 characters table
                    await this.db.prepare(`
                        INSERT OR REPLACE INTO characters 
                        (character_id, source_name, character_name, character_data, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(
                        characterId,
                        sourceName,
                        characterName,
                        JSON.stringify(characterData),
                        blob.uploadedAt,
                        blob.uploadedAt
                    ).run();

                    results.success++;
                    console.log(`Migrated character: ${characterId}`);

                } catch (error) {
                    results.errors++;
                    results.errorDetails.push({
                        file: blob.pathname,
                        error: error.message
                    });
                    console.error(`Error migrating character ${blob.pathname}:`, error);
                }
            }

        } catch (error) {
            results.errors++;
            results.errorDetails.push({
                stage: "list_characters",
                error: error.message
            });
            console.error("Error listing characters:", error);
        }

        return results;
    }

    /**
     * Get migration status and statistics
     */
    async getStatus() {
        try {
            const sourceCount = await this.db.prepare("SELECT COUNT(*) as count FROM sources").first();
            const characterCount = await this.db.prepare("SELECT COUNT(*) as count FROM characters").first();
            
            return {
                sources: sourceCount.count,
                characters: characterCount.count,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

/**
 * Migration endpoint for the Cloudflare Worker
 * Call this endpoint to trigger the migration: POST /migrate
 */
export async function handleMigration(request, env) {
    if (request.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const migration = new VorcelToD1Migration(env);
        const result = await migration.migrate();
        
        return new Response(JSON.stringify(result, null, 2), {
            headers: { "Content-Type": "application/json" },
            status: result.success ? 200 : 500
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, null, 2), {
            headers: { "Content-Type": "application/json" },
            status: 500
        });
    }
}

/**
 * Status endpoint to check migration progress
 * GET /migrate/status
 */
export async function handleMigrationStatus(request, env) {
    if (request.method !== 'GET') {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const migration = new VorcelToD1Migration(env);
        const status = await migration.getStatus();
        
        return new Response(JSON.stringify(status, null, 2), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }, null, 2), {
            headers: { "Content-Type": "application/json" },
            status: 500
        });
    }
}