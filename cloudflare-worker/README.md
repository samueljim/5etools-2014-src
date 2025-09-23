# 5etools Character Sync & API - Cloudflare D1 Solution

This directory contains a complete Cloudflare-based solution that replaces Vercel blob storage with:
- **D1 Database**: SQL-based character and source storage
- **Workers**: REST API endpoints for character management
- **Durable Objects**: Real-time WebSocket synchronization
- **Migration Tools**: Seamless transition from Vercel blob

## 🚀 Quick Start

### Prerequisites
- Cloudflare account with Workers and D1 access
- Existing 5etools setup with Vercel blob storage
- Wrangler CLI installed

### 1. Initial Setup

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create 5etools-characters
```

### 2. Configure Database

Update `wrangler.toml` with your database ID from step 1:

```toml
[[d1_databases]]
binding = "DB"
database_name = "5etools-characters"
database_id = "your-database-id-here"  # Replace with actual ID
```

### 3. Initialize Schema

```bash
# Apply database schema
wrangler d1 execute 5etools-characters --file=schema.sql
```

### 4. Deploy

```bash
cd cloudflare-worker
wrangler deploy
```

Your worker will be available at:
`https://5etools-character-sync.your-subdomain.workers.dev`

## 📡 API Endpoints

The new system provides comprehensive REST API endpoints:

### Character Management
- **POST** `/api/characters/save` - Save/update character
- **GET** `/api/characters/get?id={id}` - Retrieve character
- **GET** `/api/characters/list` - List all characters
- **DELETE** `/api/characters/delete?id={id}&password={password}` - Delete character

### Source Management
- **POST** `/api/sources/create` - Create password-protected source
- **GET** `/api/sources/list` - List all sources with stats
- **POST** `/api/sources/validate` - Validate source password

### Migration & Utilities
- **POST** `/migrate` - Migrate data from Vercel blob
- **GET** `/migrate/status` - Check migration status
- **GET** `/` - Worker health check and endpoint info

### WebSocket (Real-time Sync)
- **WebSocket** `wss://your-worker-url.workers.dev/?room=character-sync`

## 🔄 Migration from Vercel

### 1. Set Migration Token

```bash
# Add your Vercel blob token as a worker secret
wrangler secret put VERCEL_BLOB_TOKEN
# Paste your BLOB_READ_WRITE_TOKEN when prompted
```

### 2. Run Migration

```bash
# Trigger migration via API
curl -X POST https://your-worker-url.workers.dev/migrate

# Check status
curl https://your-worker-url.workers.dev/migrate/status
```

### 3. Update Client URLs

Update your 5etools client code to use the new endpoints:

```javascript
// Replace Vercel URLs with Cloudflare Worker URLs
const API_BASE = 'https://your-worker-url.workers.dev/api';
const WEBSOCKET_URL = 'wss://your-worker-url.workers.dev/?room=character-sync';
```

## 🧪 Testing

```bash
# Run the test suite
node test-api.js

# Test against deployed worker
WORKER_URL=https://your-worker-url.workers.dev node test-api.js

# Local development testing
wrangler dev
# In another terminal:
WORKER_URL=http://localhost:8787 node test-api.js
```

## How It Works

- **WebSocket Connection**: Each client connects to the Cloudflare Worker via WebSocket
- **Room-based**: All clients join the same room (`character-sync`)
- **Broadcasting**: Messages sent by one client are broadcast to all other clients in the room
- **Real-time Sync**: Character updates are instantly sent to all connected devices

## Message Types

The WebSocket handles these message types:

- `TEST_MESSAGE` - Test connectivity between devices
- `USER_JOINED` - User connected notification
- `USER_LEFT` - User disconnected notification  
- `CHARACTER_UPDATED` - Character was modified
- `CHARACTER_DELETED` - Character was removed
- `CONNECTED` - Welcome message from server

## Cost

Cloudflare Workers WebSocket usage:
- 1,000,000 requests/month free
- $0.50 per million additional requests
- Perfect for character sync - very low cost

## Production Enhancements

For production, consider upgrading to Durable Objects for:
- Persistent room state
- Better scaling
- User presence management
- Message history

## Troubleshooting

If connection fails:

1. Check Worker URL is correct
2. Verify Worker is deployed: `wrangler deployments list`
3. Check browser console for WebSocket errors
4. Test Worker directly: open `https://your-worker-url.workers.dev` (should show "Expected WebSocket")

## Development

To test locally:
```bash
wrangler dev
# Worker runs at http://localhost:8787
# Use ws://localhost:8787 for local testing
```
