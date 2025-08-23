---
url: https://developers.cloudflare.com/d1/
scraped_date: 2025-08-21
domain: developers.cloudflare.com
title: Cloudflare D1 - Serverless SQLite Database
source: Official Cloudflare Documentation
---

# Cloudflare D1

## Overview

Cloudflare D1 is a "managed, serverless database with SQLite's SQL semantics, built-in disaster recovery, and Worker and HTTP API access."

### Key Characteristics
- Designed for horizontal scaling across multiple smaller databases
- Supports databases up to 10 GB
- Pricing based on query and storage costs
- Available on Free and Paid plans

## Features

### Database Creation
- Create databases directly from Workers
- Establish database schemas
- Import and query data

### Technical Capabilities
- SQLite-compatible SQL execution
- Time Travel backup and point-in-time recovery
- Supports restoring databases to any minute within the last 30 days

## Getting Started

1. [Create your first D1 database](/d1/get-started/)
2. Establish database schema
3. Import data
4. Query database from Workers or Pages applications

## Key Benefits for UnifiedMCP

### Serverless Architecture
- Perfect for multi-user MCP server with global distribution
- Automatic scaling based on usage
- No database server management required

### SQLite Compatibility
- Familiar SQL syntax for user accounts and billing data
- ACID transactions for data consistency
- Relational data structure for complex user management

### Integration with Workers
- Direct access from Cloudflare Workers
- Low latency queries from edge locations
- Built-in connection pooling

### Disaster Recovery
- Time Travel: Point-in-time recovery up to 30 days
- Automatic backups
- Multi-region replication

## Implementation for UnifiedMCP

### Database Schema Design
```sql
-- User accounts table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  cloudflare_oauth_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active'
);

-- OAuth tokens table (encrypted)
CREATE TABLE oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  provider TEXT NOT NULL, -- 'google' or 'microsoft'
  encrypted_token TEXT NOT NULL,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking table
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  tool_name TEXT NOT NULL,
  api_calls INTEGER DEFAULT 1,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Worker Integration Example
```typescript
export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Query user from D1
    const { results } = await env.DB.prepare(
      "SELECT * FROM users WHERE cloudflare_oauth_id = ?"
    ).bind(userId).all();
    
    // Insert usage log
    await env.DB.prepare(
      "INSERT INTO usage_logs (user_id, tool_name) VALUES (?, ?)"
    ).bind(userId, toolName).run();
    
    return new Response("Success");
  },
};
```

### Configuration in wrangler.toml
```toml
[[d1_databases]]
name = "unifiedmcp-db"
database_name = "unifiedmcp-production"
database_id = "your-database-id"
```

## Related Products
- [Cloudflare Workers](/workers/) - Compute platform for MCP server
- [Cloudflare Pages](/pages/) - Static site hosting for documentation
- [Cloudflare KV](/kv/) - Key-value storage for OAuth tokens

## Resources
- [Pricing](/d1/platform/pricing/) - Cost optimization for production
- [Platform Limits](/d1/platform/limits/) - Scale planning
- [Community Projects](/d1/reference/community-projects/) - Implementation examples

## Community Support
- [Developer Discord](https://discord.cloudflare.com)
- [@CloudflareDev on X.com](https://x.com/cloudflaredev)

## Documentation Links
- [SQL Statements](/d1/sql-api/sql-statements/) - Complete SQL reference
- [Worker API](/d1/worker-api/) - Integration patterns
- [Time Travel](/d1/reference/time-travel/) - Backup and recovery

## Best Practices for UnifiedMCP

### Data Organization
- Separate databases for different environments (dev, staging, prod)
- Use transactions for multi-table operations
- Index frequently queried columns

### Security Considerations
- Store encrypted OAuth tokens, not plaintext
- Use prepared statements to prevent SQL injection
- Implement proper access controls

### Performance Optimization
- Use connection pooling in Workers
- Optimize queries with proper indexing
- Monitor query performance and costs

### Backup Strategy
- Leverage Time Travel for point-in-time recovery
- Regular exports for disaster recovery
- Test restore procedures periodically