-- 5etools Character Database Schema
-- This schema supports character storage, user authentication, and real-time sync

-- Users table for user authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    CONSTRAINT users_username_unique UNIQUE (username)
);

-- User sessions for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT sessions_token_unique UNIQUE (session_token)
);

-- Characters table for storing character data
CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL UNIQUE, -- The user-facing character ID (name-username format)
    user_id INTEGER NOT NULL,
    character_name TEXT NOT NULL,
    character_data TEXT NOT NULL, -- JSON blob of the full character data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT characters_id_unique UNIQUE (character_id)
);

-- Character sync events table for tracking changes (optional for advanced sync)
CREATE TABLE IF NOT EXISTS character_sync_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'created', 'updated', 'deleted'
    user_id INTEGER, -- User ID from users table
    websocket_user_id TEXT, -- WebSocket session identifier
    sync_data TEXT, -- JSON data for the sync event
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Triggers to automatically update timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp
    AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_characters_timestamp
    AFTER UPDATE ON characters
BEGIN
    UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Clean up expired sessions trigger
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
    AFTER INSERT ON user_sessions
BEGIN
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS character_list AS
SELECT 
    c.character_id,
    c.character_name,
    u.username,
    c.created_at,
    c.updated_at,
    LENGTH(c.character_data) as data_size
FROM characters c
JOIN users u ON c.user_id = u.id
ORDER BY c.updated_at DESC;

CREATE VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.username,
    u.created_at as user_created,
    u.last_login,
    COUNT(c.id) as character_count,
    MAX(c.updated_at) as last_character_update
FROM users u
LEFT JOIN characters c ON u.id = c.user_id
GROUP BY u.id, u.username, u.created_at, u.last_login
ORDER BY character_count DESC;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_characters_source ON characters (source_name);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters (character_name);
CREATE INDEX IF NOT EXISTS idx_characters_updated ON characters (updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_character ON character_sync_events (character_id);
CREATE INDEX IF NOT EXISTS idx_sync_created ON character_sync_events (created_at);
