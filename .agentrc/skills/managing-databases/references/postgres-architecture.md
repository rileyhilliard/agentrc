# PostgreSQL Architecture & Maintenance

Configuration and maintenance patterns for PostgreSQL.

## Contents

- Partitioning decisions
- Indexing strategy
- VACUUM and ANALYZE tuning
- Memory configuration
- Connection pooling
- Bloat management

## Partitioning decisions

### When to partition

| Condition | Partition? |
|-----------|------------|
| Table >100M rows | Yes |
| Time-based retention (delete old data) | Yes |
| Queries always filter by a specific column | Yes |
| Table <10M rows | No |
| Queries scan full table anyway | No |

### Partition count guidelines

- Aim for dozens to low hundreds of partitions
- Each partition should have >10,000 rows
- Too many partitions = planning overhead
- Too few = no pruning benefit

### Implementation

```sql
-- Range partitioning by date (most common)
CREATE TABLE events (
    id BIGINT,
    created_at TIMESTAMPTZ,
    data JSONB
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

**Automation:** Use `pg_partman` for automatic partition creation and retention.

```sql
-- pg_partman setup
SELECT partman.create_parent(
    p_parent_table := 'public.events',
    p_control := 'created_at',
    p_type := 'native',
    p_interval := 'monthly',
    p_premake := 3
);
```

## Indexing strategy

### Index type selection

| Use case | Index type |
|----------|------------|
| Equality/range on scalar | B-tree (default) |
| Full-text search | GIN on tsvector |
| JSONB containment (`@>`) | GIN |
| JSONB key existence (`?`) | GIN |
| Array containment | GIN |
| Geometric/spatial | GiST or SP-GiST |
| Low-cardinality column | BRIN (if data is clustered) |

### Partial indexes

Index only the rows you query:

```sql
-- Only index active users
CREATE INDEX idx_users_active_email ON users(email)
    WHERE status = 'active';

-- Only index recent data
CREATE INDEX idx_events_recent ON events(type)
    WHERE created_at > '2024-01-01';
```

### Covering indexes (INCLUDE)

Avoid heap lookups for common queries:

```sql
-- Include columns needed by query
CREATE INDEX idx_orders_user ON orders(user_id)
    INCLUDE (status, total);

-- Query can be index-only scan
SELECT status, total FROM orders WHERE user_id = 123;
```

### Index maintenance

```sql
-- Find unused indexes
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey';

-- Find duplicate indexes
SELECT pg_size_pretty(sum(pg_relation_size(idx))::bigint) as size,
       (array_agg(idx))[1] as idx1, (array_agg(idx))[2] as idx2
FROM (SELECT indexrelid::regclass as idx, indrelid, indkey
      FROM pg_index) sub
GROUP BY indrelid, indkey HAVING count(*) > 1;
```

## VACUUM and ANALYZE tuning

### Autovacuum settings for high-churn tables

```sql
-- Aggressive autovacuum on hot tables
ALTER TABLE events SET (
    autovacuum_vacuum_scale_factor = 0.02,  -- vacuum at 2% dead (vs 20% default)
    autovacuum_analyze_scale_factor = 0.01, -- analyze at 1% change
    autovacuum_vacuum_cost_limit = 1000     -- work harder per run
);
```

### Manual vacuum for big cleanups

```sql
-- Check dead tuple count
SELECT relname, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;

-- Manual vacuum if needed (non-blocking)
VACUUM (VERBOSE) events;
```

## Memory configuration

### Key settings

| Setting | Guideline | Notes |
|---------|-----------|-------|
| `shared_buffers` | 25% of RAM, cap at 8GB | PostgreSQL's main cache |
| `effective_cache_size` | 75% of RAM | Tells planner about OS cache |
| `work_mem` | 32-256MB | Per-operation sort/hash memory |
| `maintenance_work_mem` | 1-2GB | For VACUUM, CREATE INDEX |

### work_mem tuning

```sql
-- Check if sorts are spilling to disk
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ORDER BY ...;
-- Look for "Sort Method: external merge"

-- Increase for session if needed
SET work_mem = '256MB';
```

**Warning:** `work_mem` is per-operation, not per-query. A complex query with 10 sorts could use 10x work_mem.

## Connection pooling

### When to use

- >50 concurrent connections
- Short-lived connections (web requests)
- Connection setup overhead matters

### PgBouncer configuration

```ini
[databases]
mydb = host=localhost dbname=mydb

[pgbouncer]
pool_mode = transaction        ; Release connection after each transaction
max_client_conn = 1000         ; Accept many client connections
default_pool_size = 20         ; But only 20 actual Postgres connections
reserve_pool_size = 5          ; Extra for bursts
```

**Pool modes:**
- `session`: Safest, least efficient (prepared statements work)
- `transaction`: Good balance (prepared statements don't work across transactions)
- `statement`: Most aggressive (no transactions)

## Bloat management

### Detecting bloat

```sql
-- Table bloat estimate
SELECT schemaname, relname,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_relation_size(relid)) as table_size,
    n_dead_tup,
    round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) as dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### Fixing bloat

**Option 1: VACUUM FULL** (locks table, rewrites completely)
```sql
VACUUM FULL events;  -- Blocks all access
```

**Warning:** Requires disk space equal to table size. A 500GB bloated table needs 500GB free space to VACUUM FULL.

**Option 2: pg_repack** (online, no locks)
```bash
pg_repack -d mydb -t events
```

**Option 3: Create new table** (for extreme cases)
```sql
CREATE TABLE events_new (LIKE events INCLUDING ALL);
INSERT INTO events_new SELECT * FROM events;
-- Then swap tables in a transaction
```
