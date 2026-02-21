# agentrc

A transpiler CLI that converts agent configuration files between formats.

## Quick Commands

```bash
bun test              # Run tests
bun test --watch      # Watch mode
bun run lint          # Lint (biome check .)
bun run lint:fix      # Lint + auto-fix
bun run typecheck     # Type check (tsc --noEmit)
bun run check         # Lint + typecheck
bun run build         # Build to dist/
bun run build:binaries # Cross-compile standalone binaries
bun run dev           # Run CLI from source
```

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0 - Runtime and package manager
- Node.js >= 18.0.0

## Project Structure

```
src/
├── cli.ts          # CLI entry point
├── commands/       # CLI command handlers
├── core/           # Core transpiler pipeline
├── adapters/       # Format adapters (input/output)
└── output/         # Output formatting
```
