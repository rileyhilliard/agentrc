# Contributing to agentrc

Thanks for your interest in contributing. This guide covers the development setup, project conventions, and how to extend agentrc with new features.

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- Node.js >= 18.0.0
- Git

## Getting started

```bash
git clone https://github.com/rileyhilliard/agentrc.git
cd agentrc
bun install
bun test
bun run check
```

If all tests pass and `check` completes without errors, you're good to go.

## Development commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Run CLI from source (e.g., `bun run dev -- build`) |
| `bun run build` | Build to `dist/` |
| `bun test` | Run tests |
| `bun test --watch` | Run tests in watch mode |
| `bun test --coverage` | Run tests with coverage report |
| `bun test --update-snapshots` | Update snapshot files |
| `bun run lint` | Lint (`biome check .`) |
| `bun run lint:fix` | Lint and auto-fix (`biome check --write .`) |
| `bun run typecheck` | Type check (`tsc --noEmit`) |
| `bun run check` | Lint + typecheck in one step |
| `bun run format` | Format all files (`biome format --write .`) |

## Project structure

```
src/
├── cli.ts                    # CLI entry point (Commander)
├── commands/                 # CLI command handlers
│   ├── init.ts               # agentrc init
│   ├── build.ts              # agentrc build
│   ├── validate.ts           # agentrc validate
│   ├── inspect.ts            # agentrc inspect <platform>
│   ├── clean.ts              # agentrc clean
│   └── migrate.ts            # agentrc migrate
├── core/                     # Core transpiler pipeline
│   ├── config.ts             # config.yaml parser + schema validation
│   ├── frontmatter.ts        # Markdown frontmatter parser
│   ├── ir.ts                 # Intermediate representation types + builder
│   └── loader.ts             # .agentrc/ directory reader
├── importers/                # Platform importers (migrate command)
│   ├── types.ts              # Import result types
│   ├── utils.ts              # Shared filesystem helpers
│   └── claude.ts             # Claude Code / plugin detection + import
├── adapters/                 # Platform adapters (build command)
│   ├── adapter.ts            # Adapter interface
│   ├── registry.ts           # Adapter lookup
│   ├── claude.ts             # Claude Code
│   ├── cursor.ts             # Cursor
│   ├── copilot.ts            # GitHub Copilot
│   ├── windsurf.ts           # Windsurf
│   ├── cline.ts              # Cline
│   ├── gemini.ts             # Gemini
│   ├── codex.ts              # Codex (OpenAI)
│   └── generic-markdown.ts   # Factory for single-file adapters
├── output/                   # Output formatting
│   ├── writer.ts             # File writer + manifest + merging
│   └── gitignore.ts          # .gitignore managed block
tests/
├── adapters/                 # Per-adapter tests
├── core/                     # Core pipeline tests
├── commands/                 # CLI command tests
├── fixtures/                 # Test fixtures (.agentrc/ directories)
│   └── full/                 # Full-featured fixture for integration tests
└── smoke.test.ts             # End-to-end smoke tests
```

For a deeper look at how the pipeline works, see [docs/architecture.md](docs/architecture.md).

## Code style

Enforced by [Biome](https://biomejs.dev/) via `bun run lint`:

- Single quotes
- Semicolons
- 2-space indent
- 100 character line width
- `const` over `let` where possible
- No `var`
- No unused variables or imports
- Trailing commas

The Biome config is in `biome.json`. Don't disable linter rules without a clear reason.

## Pre-commit hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs on every commit:

1. `biome check --write` on staged `.ts`, `.tsx`, `.js`, `.jsx`, and `.json` files (auto-fixes and re-stages)
2. `tsc --noEmit` to catch type errors

These run in parallel. If either fails, the commit is blocked. The config is in `lefthook.yml`.

## Testing

Tests use Bun's built-in test runner (`bun:test`). The project uses snapshot testing for adapter output and unit tests for core logic.

**Running tests:**

```bash
bun test                         # All tests
bun test tests/adapters          # Just adapter tests
bun test --update-snapshots      # Update snapshots after intentional changes
```

**Test fixtures:** The `tests/fixtures/full/.agentrc/` directory contains a complete `.agentrc/` config that exercises every feature (rules with all scope types, hooks, commands, skills, agents). Most integration tests load this fixture.

**Writing tests:** Test the behavior, not the implementation. For adapters, test the output files and feature flags. For core pipeline, test the IR structure and error cases.

## Adding a new adapter

The adapter interface is intentionally simple:

```typescript
interface Adapter {
  name: string;
  generate(ir: IR): AdapterResult;
}

interface AdapterResult {
  files: OutputFile[];
  warnings: string[];
  nativeFeatures: string[];
  degradedFeatures: string[];
}
```

**For platforms that only need a single markdown file** (most of them), use the generic factory:

1. In `src/adapters/registry.ts`, add a line:
   ```typescript
   const myAdapter = createGenericAdapter('myplatform', 'OUTPUT_FILE.md');
   ```
2. Add it to the `adapters` record in the same file.
3. Add the platform name to the `targets` enum in `src/core/config.ts` (the inline schema).
4. Add a test in `tests/adapters/`.

**For platforms with unique features** (like Windsurf's char limits or Cline's numeric prefixes):

1. Create `src/adapters/myplatform.ts`.
2. Implement the `Adapter` interface. Your `generate` function receives the full IR and returns output files. Adapters are pure functions: no filesystem access, no side effects.
3. Register it in `src/adapters/registry.ts`.
4. Add the platform name to the config schema in `src/core/config.ts`.
5. Add tests.

Look at `src/adapters/gemini.ts` for a simple custom adapter, or `src/adapters/windsurf.ts` for a more complex one.

## Adding a new CLI command

1. Create `src/commands/mycommand.ts` with a function that takes options and returns `Promise<void>`.
2. Register the command in `src/cli.ts` using Commander's `.command()` API. Follow the existing pattern (command name, description, options, action with try/catch).
3. Add tests in `tests/commands/`.

## PR guidelines

- All tests pass (`bun test`)
- Lint passes (`bun run lint`)
- Type check passes (`bun run typecheck`)
- Descriptive PR title
- If adding a new adapter, include an example of its output in the PR description
