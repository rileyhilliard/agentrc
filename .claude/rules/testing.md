---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/tests/**"
---

# Testing Rules

When writing tests, load the ce:writing-tests skill for general patterns.

## Commands

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun test --update-snapshots  # Update snapshots
```

## Flaky Tests

When fixing flaky tests, load the ce:fixing-flaky-tests skill.

| Symptom | Likely Cause |
|---------|--------------|
| Passes alone, fails in suite | Shared state |
| Random timing failures | Race condition |
