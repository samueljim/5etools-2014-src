# Deployment Guide: 5etools Character Sync & API Migration

This guide covers migrating from Vercel blob storage to the new Cloudflare-based solution using D1 database and Workers.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with Workers and D1 access
2. **Wrangler CLI**: Install the latest version of wrangler
3. **Vercel Data**: Your existing character data in Vercel blob storage

## Step 1: Install Dependencies

```bash
# Install Wrangler CLI globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## Step 2: Create and Configure D1 Database

```bash
cd cloudflare-worker

# Create the D1 database
wrangler d1 create 5etools-characters

# Copy the database ID from the output and update wrangler.toml
# Replace the empty database_id with the one provided
```

Update `wrangler.toml` with your database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "5etools-characters"
database_id = "your-database-id-here"  # Replace with actual ID
```

## Step 3: Initialize Database Schema

```bash
# Apply the database schema
wrangler d1 execute 5etools-characters --file=schema.sql

# For local development
wrangler d1 execute 5etools-characters --local --file=schema.sql
```

## Step 4: Set Up Environment Variables

You'll need these secrets in your Cloudflare Worker:

```bash
# Add your Vercel blob token for migration (temporary)
wrangler secret put VERCEL_BLOB_TOKEN

# Optional: Set up CORS allowed origins if needed
wrangler secret put CORS_ALLOWED_ORIGINS
```

## Step 5: Deploy the Worker

```bash
# Deploy to Cloudflare
wrangler deploy

# Your worker will be available at something like:
# https://5etools-character-sync.your-subdomain.workers.dev
```

## Step 6: Test the Deployment

```bash
# Test the basic endpoint
curl https://your-worker-url.workers.dev

# Should return JSON with available endpoints
```

## Step 7: Run Data Migration

Once deployed, you can migrate your existing Vercel data:

```bash
# Trigger migration via API
curl -X POST https://your-worker-url.workers.dev/migrate

# Check migration status
curl https://your-worker-url.workers.dev/migrate/status
```

## Step 8: Update Client Configuration

Update your 5etools client code to point to the new endpoints:

### Character API URLs
- **Save**: `https://your-worker-url.workers.dev/api/characters/save`
- **Get**: `https://your-worker-url.workers.dev/api/characters/get?id={character-id}`
- **List**: `https://your-worker-url.workers.dev/api/characters/list`
- **Delete**: `https://your-worker-url.workers.dev/api/characters/delete?id={character-id}`

### Source API URLs
- **Create**: `https://your-worker-url.workers.dev/api/sources/create`
- **List**: `https://your-worker-url.workers.dev/api/sources/list`
- **Validate**: `https://your-worker-url.workers.dev/api/sources/validate`

### WebSocket URL
- **WebSocket**: `wss://your-worker-url.workers.dev/?room=character-sync`

## Development Workflow

### Local Development

```bash
# Start local development server
wrangler dev

# Your local server will be available at http://localhost:8787
# WebSocket: ws://localhost:8787
```

### Testing Changes

```bash
# Apply schema changes locally
wrangler d1 execute 5etools-characters --local --file=schema.sql

# Test migration locally (requires VERCEL_BLOB_TOKEN in .dev.vars)
curl -X POST http://localhost:8787/migrate
```

### Production Deployment

```bash
# Deploy to production
wrangler deploy

# Run migrations on production
curl -X POST https://your-worker-url.workers.dev/migrate
```

## Environment Configuration

### Development Environment
Create a `.dev.vars` file in the cloudflare-worker directory:

```
VERCEL_BLOB_TOKEN=your_vercel_token_here
CORS_ALLOWED_ORIGINS=http://localhost:5050,https://your-5etools-domain.com
```

### Production Environment
Set these as Cloudflare Workers secrets:

```bash
wrangler secret put VERCEL_BLOB_TOKEN
wrangler secret put CORS_ALLOWED_ORIGINS
```

## Monitoring and Maintenance

### Database Maintenance

```bash
# View database info
wrangler d1 info 5etools-characters

# Query the database
wrangler d1 execute 5etools-characters --command "SELECT COUNT(*) FROM characters"

# Backup database (export to SQL)
wrangler d1 export 5etools-characters --output backup.sql
```

### Viewing Logs

```bash
# View real-time logs
wrangler tail

# View logs for specific deployment
wrangler tail --format=pretty
```

## Performance Considerations

### Database Limits
- **D1 Free Tier**: 100,000 reads/day, 100,000 writes/day
- **Character Data**: JSON stored as TEXT (efficient for this use case)
- **Indexing**: Indexes on character_id, source_name, and updated_at for performance

### Worker Limits
- **Free Tier**: 100,000 requests/day
- **Response Time**: Sub-millisecond database queries
- **Concurrent Connections**: No practical limit for WebSocket connections

### Scaling Tips
- Use caching for frequently accessed character lists
- Implement pagination for large character lists
- Consider using Durable Objects for advanced room management

## Troubleshooting

### Common Issues

1. **Database ID not found**
   - Ensure database_id in wrangler.toml matches the created database

2. **Migration fails**
   - Check VERCEL_BLOB_TOKEN is set correctly
   - Verify Vercel blob URLs are accessible

3. **WebSocket connection fails**
   - Check CORS settings
   - Verify worker URL is correct

4. **API responses are empty**
   - Check D1 database has data
   - Verify database schema is applied

### Getting Help

- **Cloudflare Documentation**: https://developers.cloudflare.com/
- **Wrangler CLI Help**: `wrangler --help`
- **D1 Documentation**: https://developers.cloudflare.com/d1/

## Migration Rollback Plan

If you need to rollback to Vercel:

1. Keep your Vercel blob storage unchanged during testing
2. Update client URLs back to Vercel endpoints
3. The migration doesn't delete Vercel data, only copies it

## Cost Estimation

### Cloudflare Costs
- **D1 Database**: Free tier covers most small/medium usage
- **Workers**: Free tier: 100k requests/day
- **Durable Objects**: $0.15/million requests (for WebSocket rooms)

### Compared to Vercel
- **Lower cost** for most usage patterns
- **Better performance** with edge database
- **More reliable** WebSocket connections