# DuckDB Advanced Querying

DuckDB-specific SQL features that simplify analytical queries.

## Contents

- ASOF JOIN
- PIVOT and UNPIVOT
- Friendly SQL shortcuts
- POSITIONAL JOIN
- QUALIFY clause
- List comprehensions
- GROUPING SETS, ROLLUP, CUBE

## ASOF JOIN

Joins time-series data by finding the closest preceding match. Solves the "what was the price at the time of this sale?" problem.

### Basic syntax

```sql
SELECT s.*, p.price
FROM sales s
ASOF JOIN prices p
  ON s.ticker = p.ticker
  AND s.sale_time >= p.price_time;
```

### How it works

For each row in `sales`, finds the row in `prices` with:
1. Matching ticker
2. The largest `price_time` that is <= `sale_time`

### Using USING syntax

```sql
-- When column names match
SELECT ticker, "when", price * shares AS value
FROM holdings h
ASOF JOIN prices p USING (ticker, "when");
```

### Common patterns

```sql
-- Point-in-time lookup for any temporal dimension
SELECT orders.*, exchange_rates.rate
FROM orders
ASOF JOIN exchange_rates
  ON orders.currency = exchange_rates.currency
  AND orders.order_date >= exchange_rates.effective_date;
```

## PIVOT and UNPIVOT

Transform between wide and long formats without complex CASE expressions.

### PIVOT (long to wide)

```sql
-- Transform:
-- | year | quarter | sales |
-- | 2023 | Q1      | 100   |
-- | 2023 | Q2      | 150   |

-- Into:
-- | year | Q1  | Q2  |
-- | 2023 | 100 | 150 |

PIVOT monthly_sales
ON quarter
USING sum(sales);
```

### Dynamic PIVOT

```sql
-- Auto-detect columns to create
PIVOT sales_data
ON quarter
USING sum(amount)
GROUP BY year;
```

### UNPIVOT (wide to long)

```sql
-- Transform:
-- | product | jan | feb | mar |
-- | A       | 10  | 20  | 30  |

-- Into:
-- | product | month | sales |
-- | A       | jan   | 10    |
-- | A       | feb   | 20    |

UNPIVOT products
ON jan, feb, mar
INTO NAME month VALUE sales;
```

### Dynamic UNPIVOT with COLUMNS

```sql
-- Unpivot all columns except specific ones
UNPIVOT products
ON COLUMNS(* EXCLUDE (product_id, product_name))
INTO NAME attribute VALUE value;
```

## Friendly SQL shortcuts

DuckDB extensions that make queries more readable.

### FROM-first queries

```sql
-- Start with FROM, add SELECT after
FROM orders
SELECT customer_id, sum(total)
WHERE status = 'completed'
GROUP BY customer_id;

-- Or skip SELECT entirely for SELECT *
FROM orders WHERE status = 'completed';
```

### Function chaining

```sql
-- Chain string operations
SELECT 'hello world'.upper().replace('WORLD', 'DUCKDB');
-- Result: 'HELLO DUCKDB'

-- Chain on columns
SELECT name.lower().trim() FROM users;
```

### Column aliases in GROUP BY

```sql
-- Reference alias directly (not standard SQL)
SELECT customer_id, extract(year from order_date) as year, sum(total)
FROM orders
GROUP BY customer_id, year;  -- Can use 'year' alias
```

### SELECT * EXCLUDE/REPLACE

```sql
-- All columns except specific ones
SELECT * EXCLUDE (password, ssn) FROM users;

-- All columns with some replaced
SELECT * REPLACE (upper(name) AS name) FROM users;
```

## POSITIONAL JOIN

Join tables by row position (like pandas index join).

```sql
-- Join by row number, not by column values
SELECT *
FROM table_a
POSITIONAL JOIN table_b;

-- Equivalent to:
SELECT *
FROM (SELECT *, row_number() OVER () as rn FROM table_a) a
JOIN (SELECT *, row_number() OVER () as rn FROM table_b) b
ON a.rn = b.rn;
```

### Use cases

- Combining parallel arrays
- Joining data without common keys
- Aligning outputs from separate computations

## QUALIFY clause

Filter window function results without a subquery.

### Without QUALIFY (standard SQL)

```sql
SELECT * FROM (
    SELECT *, row_number() OVER (PARTITION BY dept ORDER BY salary DESC) as rn
    FROM employees
) sub
WHERE rn = 1;
```

### With QUALIFY

```sql
SELECT *
FROM employees
QUALIFY row_number() OVER (PARTITION BY dept ORDER BY salary DESC) = 1;
```

### Common patterns

```sql
-- Top N per group
SELECT *
FROM orders
QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY date DESC) <= 3;

-- Filter on any window function
SELECT *
FROM sales
QUALIFY sum(amount) OVER (PARTITION BY region) > 10000;
```

## List comprehensions

Python-style list operations in SQL.

### Basic syntax

```sql
-- Transform each element
SELECT [x * 2 FOR x IN [1, 2, 3]];
-- Result: [2, 4, 6]

-- With filter
SELECT [x FOR x IN [1, 2, 3, 4, 5] IF x > 2];
-- Result: [3, 4, 5]
```

### On columns

```sql
-- Transform array column
SELECT [upper(tag) FOR tag IN tags] as upper_tags
FROM posts;

-- Nested comprehension
SELECT [x + y FOR x IN [1, 2] FOR y IN [10, 20]];
-- Result: [11, 21, 12, 22]
```

## GROUPING SETS, ROLLUP, CUBE

Multiple aggregation levels in one query.

### GROUPING SETS

```sql
-- Multiple independent groupings
SELECT region, product, sum(sales)
FROM orders
GROUP BY GROUPING SETS (
    (region, product),  -- By region and product
    (region),           -- By region only
    (product),          -- By product only
    ()                  -- Grand total
);
```

### ROLLUP

```sql
-- Hierarchical aggregation (drilldown)
SELECT year, quarter, month, sum(sales)
FROM orders
GROUP BY ROLLUP (year, quarter, month);

-- Produces:
-- year, quarter, month (most detailed)
-- year, quarter, NULL
-- year, NULL, NULL
-- NULL, NULL, NULL (grand total)
```

### CUBE

```sql
-- All possible combinations
SELECT region, product, sum(sales)
FROM orders
GROUP BY CUBE (region, product);

-- Produces:
-- region, product
-- region, NULL
-- NULL, product
-- NULL, NULL
```

### Identifying grouping level

```sql
SELECT
    CASE WHEN grouping(region) = 1 THEN 'All' ELSE region END as region,
    CASE WHEN grouping(product) = 1 THEN 'All' ELSE product END as product,
    sum(sales)
FROM orders
GROUP BY CUBE (region, product);
```
