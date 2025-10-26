# Database Connection Configuration Guide

## Overview

This guide explains the enhanced database connection handling implemented to resolve intermittent connection issues in both development and production environments.

## What Was Fixed

### 1. **Connection Pooling & Configuration**
- Added proper Prisma client configuration with logging
- Implemented connection event monitoring (warnings and errors)
- Added connection pool parameter support via DATABASE_URL

### 2. **Automatic Retry Logic**
- Implemented `withRetry()` utility function with exponential backoff
- Automatically retries on connection errors (P1001, P1002, P1008, P1017, P2024)
- Smart detection of network/connection issues vs application errors
- Configurable retry attempts (default: 3) with jitter to prevent thundering herd

### 3. **Health Monitoring & Auto-Reconnection**
- Enhanced health check with `ensureDbConnection()` function
- Automatic reconnection on connection failure
- Proactive health checks every 2 minutes
- Connection verification before server startup

### 4. **Error Logging & Debugging**
- Comprehensive logging of connection issues
- Detailed error tracking with Prisma error codes
- Reconnection attempt logging

## Database URL Configuration

### Development Environment

For local PostgreSQL:
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/dbname?connection_limit=10&pool_timeout=20&connect_timeout=10"
```

### Production Environment

For production PostgreSQL (e.g., Render, Supabase, AWS RDS):
```bash
DATABASE_URL="postgresql://username:password@host:5432/dbname?connection_limit=20&pool_timeout=30&connect_timeout=15&socket_timeout=30"
```

### Connection Pool Parameters Explained

| Parameter | Description | Recommended Value |
|-----------|-------------|-------------------|
| `connection_limit` | Maximum number of connections in the pool | Dev: 10, Prod: 20-50 |
| `pool_timeout` | Max seconds to wait for available connection | 20-30 seconds |
| `connect_timeout` | Max seconds to wait when establishing connection | 10-15 seconds |
| `socket_timeout` | Max seconds to wait for query response | 30-60 seconds |

### For Supabase

Supabase provides connection pooling. Use the **Transaction** pooling mode for best results:

```bash
# Transaction mode (recommended)
DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=10"
```

### For Render.com PostgreSQL

Render's managed PostgreSQL:
```bash
DATABASE_URL="postgresql://[username]:[password]@[host]/[database]?ssl=true&connection_limit=15&pool_timeout=25"
```

## Using the Retry Utility

### In Services

Wrap critical database operations with `withRetry()`:

```typescript
import { prisma, withRetry } from '../prisma';

export class MyService {
  static async criticalOperation(userId: string) {
    return await withRetry(async () => {
      return await prisma.user.findUnique({
        where: { id: userId },
        include: { plan: true }
      });
    });
  }
}
```

### Custom Retry Configuration

```typescript
// More aggressive retries for critical operations
await withRetry(
  async () => await prisma.user.create({ data: userData }),
  5,    // maxRetries: 5 attempts
  500   // baseDelay: 500ms starting delay
);

// Quick fail for non-critical operations
await withRetry(
  async () => await prisma.log.create({ data: logData }),
  1,    // maxRetries: only 1 retry
  1000  // baseDelay: 1 second delay
);
```

## Best Practices

### 1. **Always Close Transactions**
```typescript
try {
  await prisma.$transaction(async (tx) => {
    // your transaction logic
  });
} catch (error) {
  // handle error - transaction auto-rolls back
}
```

### 2. **Use Connection Timeout Strategically**
- Short timeouts (5-10s) for health checks
- Longer timeouts (30-60s) for complex queries
- Medium timeouts (15-20s) for normal operations

### 3. **Monitor Connection Pool Usage**
Check Prisma metrics in production:
```typescript
// In a monitoring endpoint
const metrics = await prisma.$metrics.json();
```

### 4. **Adjust Pool Size Based on Load**
- Small apps: 5-10 connections
- Medium apps: 10-20 connections
- High-traffic apps: 20-50 connections
- Never exceed your database's max_connections limit

### 5. **Use PgBouncer for High-Traffic Apps**
For serverless or high-concurrency scenarios, consider PgBouncer:
```bash
# Example with Supabase's built-in PgBouncer
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true"
```

## Troubleshooting

### Issue: "Too many connections"
**Solution:**
1. Lower `connection_limit` in DATABASE_URL
2. Check if you're properly closing connections
3. Use PgBouncer for connection pooling

### Issue: "Connection timeout"
**Solution:**
1. Increase `connect_timeout` and `pool_timeout`
2. Check network connectivity to database
3. Verify database server isn't overloaded

### Issue: "Connection refused" (ECONNREFUSED)
**Solution:**
1. Verify DATABASE_URL is correct
2. Check firewall/security group rules
3. Ensure database server is running
4. Check SSL requirements (add `?ssl=true` if needed)

### Issue: "SSL connection required"
**Solution:**
Add SSL parameter to DATABASE_URL:
```bash
DATABASE_URL="postgresql://...?ssl=true&sslmode=require"
```

## Monitoring in Production

### Check Connection Health
The gateway now logs database health status every 2 minutes. Monitor logs for:
- `Database health check passed` (good)
- `Database health check failed` (investigate)
- `Successfully reconnected to database` (recovered from issue)

### Key Metrics to Monitor
1. Connection pool exhaustion events
2. Query timeout frequency
3. Reconnection attempts
4. Average connection acquisition time

## Environment Variables

Ensure these are properly set:

```bash
# Required
DATABASE_URL="postgresql://..."

# Optional but recommended for production
NODE_ENV="production"

# For Prisma logging (development only)
DEBUG="prisma:*"
```

## Migration Notes

No database schema changes were required. To apply the code changes:

1. **Update dependencies** (if needed):
   ```bash
   cd gateway
   pnpm install
   ```

2. **Regenerate Prisma Client**:
   ```bash
   pnpm prisma generate
   ```

3. **Restart the gateway**:
   ```bash
   pnpm run dev  # development
   # or
   pnpm run build && pnpm start  # production
   ```

## Testing the Fix

### 1. Test Connection Resilience
```bash
# Simulate connection issues by restarting your database
# The gateway should automatically reconnect
```

### 2. Monitor Logs
```bash
# Watch for successful reconnection messages
tail -f gateway.log | grep -i "database\|connection"
```

### 3. Stress Test
```bash
# Run concurrent requests to test pool management
ab -n 1000 -c 50 http://localhost:4000/api/health
```

## Additional Resources

- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/usage.html)

---

**Last Updated:** October 26, 2025

