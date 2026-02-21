# PostgreSQL Advanced Querying

Non-obvious query techniques and optimization patterns.

## Contents

- LATERAL joins
- CTE materialization control
- DISTINCT ON
- Index-only scans
- EXPLAIN ANALYZE interpretation
- Window frame specifications
- Parallel query tuning

## LATERAL joins

LATERAL allows subqueries to reference columns from preceding tables. Use when you need correlated subqueries that return multiple rows/columns.

### When to use LATERAL

| Scenario | Use LATERAL? |
|----------|--------------|
| Top-N per group | Yes |
| Correlated subquery returning multiple columns | Yes |
| Table function with parameters from outer query | Yes |
| Simple join | No, use regular JOIN |
| Uncorrelated subquery | No |

### Top-N per group pattern

```sql
-- Get the 3 most recent orders per customer
SELECT c.id, c.name, recent_orders.*
FROM customers c
CROSS JOIN LATERAL (
    SELECT o.id, o.total, o.created_at
    FROM orders o
    WHERE o.customer_id = c.id
    ORDER BY o.created_at DESC
    LIMIT 3
) recent_orders;
```

### Set-returning function pattern

```sql
-- Unnest array and join with related data
SELECT u.id, u.name, t.tag
FROM users u
CROSS JOIN LATERAL unnest(u.tags) AS t(tag);
```

## CTE materialization control

PostgreSQL 12+ changed CTE behavior. CTEs are now inlined by default if referenced once.

### Force materialization

Use when the CTE is expensive and referenced multiple times, or when you want to create an optimization barrier:

```sql
WITH expensive_calc AS MATERIALIZED (
    SELECT user_id, sum(amount) as total
    FROM transactions
    GROUP BY user_id
)
SELECT * FROM expensive_calc WHERE total > 1000
UNION ALL
SELECT * FROM expensive_calc WHERE total < 100;
```

### Force inlining

Use when you want the optimizer to push predicates into the CTE:

```sql
WITH filtered_data AS NOT MATERIALIZED (
    SELECT * FROM large_table
)
SELECT * FROM filtered_data
WHERE status = 'active';  -- This predicate gets pushed down
```

### When materialization helps

- CTE is used multiple times
- You want predictable execution (optimization fence)
- CTE result is small but query on it is complex

### When inlining helps

- CTE is used once
- Predicates from outer query should filter CTE
- You want the optimizer to see the full picture

## DISTINCT ON

PostgreSQL-specific way to get first row per group. Faster than window functions for simple cases.

```sql
-- Get most recent order per customer
SELECT DISTINCT ON (customer_id)
    customer_id, id, total, created_at
FROM orders
ORDER BY customer_id, created_at DESC;
```

**Requirements:**
- DISTINCT ON columns must be leftmost in ORDER BY
- ORDER BY determines which row is "first"

**Compared to window functions:**

```sql
-- Window function equivalent (slower for large datasets)
SELECT * FROM (
    SELECT *, row_number() OVER (
        PARTITION BY customer_id ORDER BY created_at DESC
    ) as rn
    FROM orders
) sub WHERE rn = 1;
```

## Index-only scans

When PostgreSQL can answer a query entirely from the index without touching the table heap.

### Requirements for index-only scan

1. All columns in SELECT are in the index (or INCLUDE'd)
2. Visibility map shows pages are all-visible (recently vacuumed)
3. No columns need to be fetched from heap

### Checking if it's working

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT user_id, email FROM users WHERE user_id = 123;

-- Look for:
-- "Index Only Scan"
-- "Heap Fetches: 0" (ideal)
```

### Heap fetches indicate stale visibility map

```sql
-- If you see high heap fetches, vacuum the table
VACUUM users;
```

### Creating indexes for index-only scans

```sql
-- INCLUDE adds columns to leaf pages without affecting index ordering
CREATE INDEX idx_users_lookup ON users(user_id) INCLUDE (email, name);
```

## EXPLAIN ANALYZE interpretation

### Key metrics to watch

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;
```

| Metric | What it means |
|--------|---------------|
| `actual time` | Real execution time (first row..last row) |
| `rows` | Actual rows vs estimated (bad estimates = bad plans) |
| `Buffers: shared hit` | Pages found in cache |
| `Buffers: shared read` | Pages read from disk |
| `Sort Method: external merge` | Sort spilled to disk (increase work_mem) |
| `Rows Removed by Filter` | Post-fetch filtering (missing index?) |

### Red flags

- **Nested Loop with high outer rows**: Consider hash/merge join
- **Seq Scan on large table**: Missing index or bad statistics
- **Large difference between estimated and actual rows**: Run ANALYZE
- **Many buffers read vs hit**: Cold cache or table too large for memory

### Example analysis

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 123;

-- Good output:
Index Scan using idx_orders_customer on orders (cost=0.43..8.45 rows=1 width=100) (actual time=0.015..0.016 rows=1 loops=1)
  Index Cond: (customer_id = 123)
  Buffers: shared hit=3
Planning Time: 0.085 ms
Execution Time: 0.031 ms

-- Bad output (missing index):
Seq Scan on orders (cost=0.00..12345.00 rows=1 width=100) (actual time=500.000..500.001 rows=1 loops=1)
  Filter: (customer_id = 123)
  Rows Removed by Filter: 999999
  Buffers: shared read=5000
```

## Window frame specifications

Window functions operate over a frame of rows. Understanding frames prevents subtle bugs.

### Frame types

| Frame | Behavior |
|-------|----------|
| `ROWS` | Physical rows relative to current |
| `RANGE` | Logical range based on ORDER BY value |
| `GROUPS` | Groups of rows with same ORDER BY value |

### Common patterns

```sql
-- Running total (default frame is RANGE UNBOUNDED PRECEDING)
SELECT date, amount,
    sum(amount) OVER (ORDER BY date) as running_total
FROM transactions;

-- Moving average (explicit ROWS frame)
SELECT date, amount,
    avg(amount) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as avg_7day
FROM transactions;

-- Cumulative within groups
SELECT department, date, amount,
    sum(amount) OVER (
        PARTITION BY department
        ORDER BY date
        ROWS UNBOUNDED PRECEDING
    ) as dept_cumulative
FROM expenses;
```

### Gotcha: RANGE vs ROWS with duplicates

```sql
-- With ties in ORDER BY, RANGE includes all ties
SELECT value,
    sum(value) OVER (ORDER BY value RANGE UNBOUNDED PRECEDING) as range_sum,
    sum(value) OVER (ORDER BY value ROWS UNBOUNDED PRECEDING) as rows_sum
FROM (VALUES (1), (2), (2), (3)) t(value);

-- value | range_sum | rows_sum
--     1 |         1 |        1
--     2 |         5 |        3  <- RANGE includes both 2s
--     2 |         5 |        5  <- RANGE includes both 2s
--     3 |         8 |        8
```

## Parallel query tuning

PostgreSQL can parallelize sequential scans, joins, and aggregates.

### Settings

```sql
-- Check parallel settings
SHOW max_parallel_workers_per_gather;  -- Default 2
SHOW min_parallel_table_scan_size;     -- Default 8MB
SHOW parallel_tuple_cost;              -- Default 0.1
```

### When parallel helps

- Large sequential scans
- Hash joins on large tables
- Aggregates over many rows
- Parallel-safe functions only

### Forcing parallel for testing

```sql
SET parallel_setup_cost = 0;
SET parallel_tuple_cost = 0;
SET min_parallel_table_scan_size = 0;
SET max_parallel_workers_per_gather = 4;

EXPLAIN (ANALYZE) SELECT count(*) FROM large_table;
-- Look for "Workers Planned" and "Workers Launched"
```

### Why parallel might not engage

1. Table too small (below min_parallel_table_scan_size)
2. Not enough parallel workers available
3. Query uses parallel-unsafe functions
4. Inside a cursor or function
5. Already in a parallel worker
