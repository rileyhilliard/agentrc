# DuckDB Architecture

Understanding DuckDB's storage model and when it excels.

## Contents

- Columnar storage tradeoffs
- Vectorized execution
- Thread configuration
- Out-of-core processing
- Persistence modes
- pg_duckdb integration

## Columnar storage tradeoffs

### When DuckDB excels

| Workload | DuckDB performance |
|----------|-------------------|
| Full table aggregations | Excellent (10-1000x vs row stores) |
| Column subset scans | Excellent |
| Filter + aggregate | Excellent |
| Single row lookup by ID | Poor (use PostgreSQL) |
| Many small transactions | Poor (use PostgreSQL) |
| Heavy updates/deletes | Poor (append-only is fine) |

### Why columnar is fast for analytics

- Only reads columns needed by query
- Same-type data compresses well (often 10x)
- SIMD operations on column batches
- No row reconstruction for aggregates

### Data layout implications

```sql
-- This is fast: scans only 2 columns
SELECT region, sum(sales) FROM orders GROUP BY region;

-- This is slower: must read all columns
SELECT * FROM orders LIMIT 100;
```

## Vectorized execution

DuckDB processes data in vectors (typically 1024-2048 rows) that fit in CPU L1 cache.

### What this means in practice

- Don't worry about row-by-row overhead
- Batch operations are automatically vectorized
- User-defined functions should be vectorized when possible

### Checking execution

```sql
EXPLAIN ANALYZE SELECT sum(amount) FROM transactions WHERE status = 'completed';
-- Shows operator timing and cardinalities
```

## Thread configuration

### Default behavior

DuckDB automatically uses all available CPU cores. Usually this is optimal.

### Remote data special case

For queries over HTTP (Parquet files on S3, HTTP servers), increase threads beyond CPU count:

```sql
-- Network-bound queries benefit from more threads
SET threads = 32;  -- Even on 8-core machine

-- Why: threads spend time waiting for network I/O
-- More threads = more concurrent requests = better bandwidth utilization
```

### Reducing parallelism

For resource-constrained environments:

```sql
SET threads = 2;  -- Limit CPU usage
SET memory_limit = '2GB';  -- Limit memory
```

## Out-of-core processing

DuckDB handles datasets larger than RAM by spilling to disk.

### How it works

- Automatically spills hash tables and sorts to temp directory
- Transparent to user (just slower)
- No configuration needed for basic cases

### Configuring temp storage

```sql
-- Set temp directory for spilling
SET temp_directory = '/path/to/fast/ssd/duckdb_temp';

-- Check memory usage during query
SELECT * FROM duckdb_memory();
```

### Memory limits

```sql
-- Set explicit memory limit
SET memory_limit = '8GB';

-- Check current setting
SELECT current_setting('memory_limit');
```

## Concurrency model

**Critical limitation:** DuckDB is single-writer, multiple-reader.

| Operation | Concurrent access |
|-----------|------------------|
| Multiple readers | Yes (with `read_only=True`) |
| Single writer | Yes |
| Multiple writers | No (will fail or corrupt) |

### For web applications

Use DuckDB for reads only. Write through a different path (PostgreSQL, direct Parquet files).

```python
# Safe: Multiple processes can read
conn = duckdb.connect('db.duckdb', read_only=True)

# Unsafe: Only one process should write
conn = duckdb.connect('db.duckdb')  # Exclusive write lock
```

### Why this matters

If you design a system expecting DuckDB to handle concurrent writes like PostgreSQL, you'll hit lock contention errors or corruption. The common pattern is:
- PostgreSQL for writes and metadata
- DuckDB for analytical reads on Parquet files

## Persistence modes

### In-memory (default)

```python
import duckdb
conn = duckdb.connect()  # In-memory, lost on close
```

### Persistent file

```python
conn = duckdb.connect('my_database.duckdb')
```

### Read-only mode

```python
conn = duckdb.connect('my_database.duckdb', read_only=True)
# Multiple processes can read simultaneously
```

### Choosing persistence mode

| Use case | Mode |
|----------|------|
| Ad-hoc analysis | In-memory |
| Repeated queries on same data | Persistent |
| Shared read access | Persistent + read_only |
| ETL intermediate steps | In-memory |

## pg_duckdb integration

Run DuckDB queries inside PostgreSQL for analytics on Postgres data.

### When to use pg_duckdb

- Analytical queries on PostgreSQL tables
- Avoid data movement for mixed workloads
- Query Parquet/CSV directly from PostgreSQL

### Basic usage

```sql
-- Enable DuckDB execution
SET duckdb.execution = true;

-- Query uses DuckDB engine automatically for supported queries
SELECT region, sum(sales)
FROM orders
GROUP BY region;

-- Query external Parquet
SELECT * FROM read_parquet('s3://bucket/data/*.parquet');
```

### Limitations

- Not all PostgreSQL features supported
- Write operations still use PostgreSQL
- Some type conversions may differ

### When NOT to use pg_duckdb

- Simple OLTP queries (PostgreSQL is faster)
- Queries with PostgreSQL-specific features
- When DuckDB's query semantics differ from PostgreSQL's
