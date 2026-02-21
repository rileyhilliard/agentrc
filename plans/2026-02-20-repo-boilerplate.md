# Repository Boilerplate Setup

> **Status:** DRAFT

## Specification

**Problem:** The agentrc repository is empty (just a README, LICENSE, and architecture plan). Before any feature work can start, we need a working project scaffold with TypeScript compilation, linting, testing, CLI entry point, and the directory structure defined in the architecture doc.

**Goal:** After this plan is done, a developer can clone the repo, run `bun install`, and immediately start working on feature code. `bun test` runs and passes. `bun run lint` works. `bun run dev -- --help` launches the CLI skeleton. The directory structure matches the architecture plan. Type checking is strict.

**Scope:**
- In: package.json, tsconfig, biome, bunfig, directory structure, CLI skeleton, test setup, gitignore
- Out: Actual feature implementation (parsers, adapters, IR, commands). Those come in the next plan.

**Success Criteria:**

- [ ] `bun install` completes with zero errors
- [ ] `bun run build` produces a working CLI in `dist/`
- [ ] `node dist/cli.js --help` works (Node-compatible build)
- [ ] `bun run dev -- --help` shows the agentrc help text with all planned subcommands
- [ ] `bun test` runs and passes
- [ ] `bun run lint` passes with zero warnings
- [ ] `bun run typecheck` passes with zero errors
- [ ] Directory structure matches the architecture plan
- [ ] Pre-commit hooks run Biome lint + typecheck on staged files
- [ ] GitHub Actions CI workflow is configured
- [ ] VS Code format-on-save works with Biome

## Context Loading

_Run before starting:_

```bash
read plans/26-02-20-architecture.md  # Lines 680-767 (Tech Stack + Project Structure)
read README.md
read LICENSE
```

## Tasks

### Project Config Tasks

#### Task 1: Create package.json and install dependencies

**Context:** `plans/26-02-20-architecture.md` (Tech Stack section, lines 708-720)

**Steps:**

1. [ ] Create `package.json` with:
   - `name`: `agentrc`
   - `version`: `0.1.0`
   - `type`: `module`
   - `bin`: `{ "agentrc": "./dist/cli.js" }`
   - `main`: `./dist/cli.js`
   - `files`: `["dist", "schemas"]`
   - Scripts:
     - `dev`: `bun run src/cli.ts`
     - `build`: `bun build src/cli.ts --outdir dist --target node --packages external`
     - `prepublishOnly`: `bun run build`
     - `test`: `bun test`
     - `test:watch`: `bun test --watch`
     - `test:update`: `bun test --update-snapshots`
     - `lint`: `biome check .`
     - `lint:fix`: `biome check --write .`
     - `typecheck`: `tsc --noEmit`
     - `format`: `biome format --write .`
     - `check`: `biome check . && tsc --noEmit`
   - Production dependencies: `commander`, `gray-matter`, `yaml`, `ajv`, `picomatch`, `chalk`
   - Dev dependencies: `@biomejs/biome`, `typescript`, `@types/bun`
2. [ ] Run `bun install`
3. [ ] Verify `bun install` succeeds and `node_modules` is populated

Notes:
- `--packages external` keeps npm deps out of the bundle so they resolve normally when installed via npm. Without this, `bun build` inlines everything into one file, bloating the package and risking issues with native deps.
- `prepublishOnly` ensures `dist/` is built before publishing to npm.
- `lint` is read-only (safe for CI); `lint:fix` auto-fixes (for dev use).

**Verify:** `bun install && ls node_modules/commander`

---

#### Task 2: Create TypeScript and Biome config

**Steps:**

1. [ ] Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "lib": ["ESNext"],
       "target": "ESNext",
       "module": "ESNext",
       "moduleDetection": "force",
       "moduleResolution": "bundler",
       "allowImportingTsExtensions": true,
       "verbatimModuleSyntax": true,
       "noEmit": true,
       "strict": true,
       "skipLibCheck": true,
       "noFallthroughCasesInSwitch": true,
       "noUncheckedIndexedAccess": true,
       "noImplicitOverride": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "outDir": "./dist",
       "rootDir": "./src",
       "types": ["bun-types"]
     },
     "include": ["src/**/*.ts"],
     "exclude": ["node_modules", "dist", "tests"]
   }
   ```
   Notes:
   - No `esModuleInterop` because it's redundant with `verbatimModuleSyntax` and causes diagnostics.
   - No `declaration`/`declarationMap`/`sourceMap` because `noEmit: true` makes them no-ops. If we need `.d.ts` for programmatic consumers later, we'll add a `tsconfig.build.json` without `noEmit`.
   - `tests/` excluded from `tsc --noEmit` because Bun handles test TS natively. Test type errors surface at runtime.

2. [ ] Create `biome.json` (check the installed biome version and use its matching schema URL):
   ```json
   {
     "$schema": "https://biomejs.dev/schemas/<INSTALLED_VERSION>/schema.json",
     "organizeImports": { "enabled": true },
     "linter": {
       "enabled": true,
       "rules": {
         "recommended": true,
         "correctness": {
           "noUnusedVariables": { "level": "error", "fix": "safe" },
           "noUnusedImports": { "level": "error", "fix": "safe" }
         },
         "style": {
           "useConst": "error",
           "noVar": "error"
         }
       }
     },
     "formatter": {
       "enabled": true,
       "indentStyle": "space",
       "indentWidth": 2,
       "lineWidth": 100
     },
     "javascript": {
       "formatter": {
         "semicolons": "always",
         "quoteStyle": "single",
         "trailingCommas": "all",
         "arrowParens": "always"
       }
     },
     "files": {
       "ignore": [
         "dist",
         "node_modules",
         "**/*.snap",
         "__snapshots__",
         "*.md"
       ]
     }
   }
   ```
   Note: Replace `<INSTALLED_VERSION>` with the actual installed biome version after `bun install` (e.g., `1.9.4`). Run `bunx biome --version` to check.

3. [ ] Verify config is valid: `bun run typecheck && bun run lint`

**Verify:** `bun run typecheck && bun run lint`

---

#### Task 3: Create .gitignore and bunfig.toml

**Steps:**

1. [ ] Update `.gitignore` with:
   ```
   # Dependencies
   node_modules/

   # Build output
   dist/

   # Coverage reports
   coverage/

   # OS files
   .DS_Store

   # agentrc generated backup directory
   .agentrc/.backup/
   .agentrc/.manifest.json
   ```
   Note: `bun.lock` is NOT gitignored. Commit the lockfile for reproducible installs.

2. [ ] Create `bunfig.toml` (minimal, Bun defaults are good):
   ```toml
   [test]
   coverage = false
   coverageReporter = ["text", "lcov"]
   ```

**Verify:** `cat .gitignore && cat bunfig.toml`

---

### Source Scaffold Tasks

#### Task 4: Create directory structure and CLI entry point

**Context:** `plans/26-02-20-architecture.md` (Project Structure, lines 722-767)

**Steps:**

1. [ ] Create the full directory structure:
   ```
   src/
   ├── cli.ts
   ├── core/
   │   ├── loader.ts
   │   ├── frontmatter.ts
   │   ├── config.ts
   │   └── ir.ts
   ├── adapters/
   │   ├── adapter.ts
   │   ├── claude.ts
   │   ├── cursor.ts
   │   ├── copilot.ts
   │   ├── windsurf.ts
   │   ├── cline.ts
   │   ├── gemini.ts
   │   ├── codex.ts
   │   ├── generic-markdown.ts
   │   └── registry.ts
   ├── output/
   │   ├── writer.ts
   │   └── gitignore.ts
   └── commands/
       ├── build.ts
       ├── init.ts
       ├── validate.ts
       ├── inspect.ts
       ├── clean.ts
       └── migrate.ts
   schemas/
   └── (empty, will hold agentrc.v1.schema.json)
   templates/
   └── minimal/
       └── (empty, will hold starter .agentrc/ templates)
   tests/
   ├── adapters/
   ├── core/
   └── fixtures/
   ```

2. [ ] Create `src/cli.ts` as the Commander.js entry point with all planned subcommands stubbed:
   ```typescript
   #!/usr/bin/env node
   import { Command } from 'commander';

   const program = new Command();

   program
     .name('agentrc')
     .description('Transpile .agentrc/ config into platform-native AI agent features')
     .version('0.1.0');

   program
     .command('build')
     .description('Build platform-native config from .agentrc/')
     .option('-t, --targets <platforms>', 'Comma-separated target platforms')
     .option('--dry-run', 'Preview what would be generated without writing files')
     .action((options) => {
       console.log('build command (not yet implemented)', options);
     });

   program
     .command('validate')
     .description('Validate .agentrc/ config without building')
     .action(() => {
       console.log('validate command (not yet implemented)');
     });

   program
     .command('inspect <platform>')
     .description('Show what a specific platform would receive')
     .action((platform) => {
       console.log(`inspect ${platform} (not yet implemented)`);
     });

   program
     .command('clean')
     .description('Remove all generated files')
     .action(() => {
       console.log('clean command (not yet implemented)');
     });

   program
     .command('init')
     .description('Initialize a new .agentrc/ directory')
     .option('-t, --template <name>', 'Starter template to use')
     .action((options) => {
       console.log('init command (not yet implemented)', options);
     });

   program
     .command('migrate')
     .description('Import existing platform config into .agentrc/')
     .action(() => {
       console.log('migrate command (not yet implemented)');
     });

   program.parse();
   ```

3. [ ] Create stub files for each module. Each stub exports the expected interface shape but with `TODO` implementations. Specifically:

   `src/core/ir.ts` - export the IR types (the contract everything else depends on):
   ```typescript
   // IR types: the normalized, platform-agnostic model

   export type RuleScope = 'always' | 'glob' | 'description' | 'manual';
   export type Priority = 'critical' | 'high' | 'normal' | 'low';

   export interface Rule {
     name: string;
     scope: RuleScope;
     content: string;
     globs?: string[];
     description?: string;
     alwaysApply?: boolean;
     priority: Priority;
     sourcePath: string;
   }

   export interface Hook {
     event: 'post-edit' | 'pre-commit' | 'post-create';
     match?: string;
     run: string;
     description: string;
   }

   export interface AgentCommand {
     name: string;
     description: string;
     content: string;
     aliases?: string[];
     sourcePath: string;
   }

   export interface Skill {
     name: string;
     description: string;
     content: string;
     files: Record<string, string>;
     sourcePath: string;
   }

   export interface IR {
     rules: Rule[];
     hooks: Hook[];
     commands: AgentCommand[];
     skills: Skill[];
     targets: string[];
   }
   ```
   Note: `Skill.files` uses `Record<string, string>` not `Map` because Map doesn't serialize to JSON (breaks snapshot tests).

   `src/adapters/adapter.ts` - export the adapter interface:
   ```typescript
   import type { IR } from '../core/ir';

   export interface OutputFile {
     path: string;
     content: string;
   }

   export interface AdapterResult {
     files: OutputFile[];
     warnings: string[];
     nativeFeatures: string[];
     degradedFeatures: string[];
   }

   export interface Adapter {
     name: string;
     generate(ir: IR): AdapterResult;
   }
   ```

   All other stub files should export an empty object or placeholder function with a `// TODO: implement` comment.

4. [ ] Verify the CLI boots and typecheck passes. If `import { Command } from 'commander'` fails under `verbatimModuleSyntax`, switch to a default import or adjust the import style to match how commander exports its types.

**Verify:** `bun run src/cli.ts --help && bun run typecheck`

---

### Test Infrastructure Tasks

#### Task 5: Set up test infrastructure with a smoke test

**Context:** `plans/26-02-20-architecture.md` (Testing Strategy, lines 769-782)

**Steps:**

1. [ ] Create `tests/fixtures/minimal/` with a minimal `.agentrc/` directory:
   ```
   tests/fixtures/minimal/.agentrc/
   ├── config.yaml
   └── rules/
       └── typescript.md
   ```

   `config.yaml`:
   ```yaml
   version: "1"
   targets:
     - claude
     - cursor
   ```

   `typescript.md`:
   ```markdown
   ---
   alwaysApply: true
   priority: high
   ---

   Use strict TypeScript. No `any` types.
   ```

2. [ ] Create `tests/core/ir.test.ts` - a basic test validating the IR types:
   ```typescript
   import { describe, test, expect } from 'bun:test';
   import type { IR, Rule } from '../../src/core/ir';

   describe('IR types', () => {
     test('Rule type accepts valid rule', () => {
       const rule: Rule = {
         name: 'typescript-strict',
         scope: 'always',
         content: 'Use strict TypeScript.',
         alwaysApply: true,
         priority: 'high',
         sourcePath: '.agentrc/rules/typescript.md',
       };
       expect(rule.name).toBe('typescript-strict');
       expect(rule.scope).toBe('always');
     });

     test('IR type holds all sections', () => {
       const ir: IR = {
         rules: [],
         hooks: [],
         commands: [],
         skills: [],
         targets: ['claude', 'cursor'],
       };
       expect(ir.targets).toEqual(['claude', 'cursor']);
     });
   });
   ```

3. [ ] Create `tests/smoke.test.ts` - verify the CLI boots:
   ```typescript
   import { describe, test, expect } from 'bun:test';

   describe('CLI', () => {
     test('--help exits with code 0 and shows usage', async () => {
       const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', '--help'], {
         stdout: 'pipe',
         stderr: 'pipe',
       });
       const exitCode = await proc.exited;
       const stdout = await new Response(proc.stdout).text();
       expect(exitCode).toBe(0);
       expect(stdout).toContain('agentrc');
       expect(stdout).toContain('build');
       expect(stdout).toContain('validate');
       expect(stdout).toContain('inspect');
     });

     test('--version shows version', async () => {
       const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', '--version'], {
         stdout: 'pipe',
       });
       const exitCode = await proc.exited;
       const stdout = await new Response(proc.stdout).text();
       expect(exitCode).toBe(0);
       expect(stdout).toContain('0.1.0');
     });
   });
   ```

4. [ ] Run `bun test` and verify all tests pass

**Verify:** `bun test`

---

### Build Verification Tasks

#### Task 6: Verify build pipeline and final checks

**Steps:**

1. [ ] Run `bun run build` and verify `dist/cli.js` is produced
2. [ ] Run `node dist/cli.js --help` to verify the Node-compatible build works
3. [ ] Run `bun run lint` and fix any issues (use `bun run lint:fix` for auto-fixable ones)
4. [ ] Run `bun run typecheck` and fix any type errors
5. [ ] Run full validation: `bun run check && bun test`
6. [ ] Update `README.md` with basic setup instructions:
   ```markdown
   # agentrc

   Write your agent rules once. Transpile to every platform.

   ## Development

   ```bash
   bun install
   bun run dev -- --help
   bun test
   bun run check
   ```
   ```

**Verify:** `bun run build && node dist/cli.js --help && bun run check && bun test`

---

### DX Infrastructure Tasks

#### Task 7: Set up Lefthook pre-commit hooks

**Steps:**

1. [ ] Install lefthook: `bun add --dev lefthook`
2. [ ] Create `lefthook.yml`:
   ```yaml
   pre-commit:
     parallel: true
     commands:
       biome:
         glob: "*.{ts,tsx,js,jsx,json}"
         run: bunx biome check --write --no-errors-on-unmatched {staged_files}
         stage_fixed: true
       typecheck:
         glob: "*.ts"
         run: bun run typecheck
   ```
3. [ ] Add `"prepare": "lefthook install"` to package.json scripts (runs on `bun install` for new clones)
4. [ ] Run `bunx lefthook install` to set up the git hooks locally
5. [ ] Test it: make a file with a lint error, stage it, try to commit, verify Biome catches it

**Verify:** `echo 'var x = 1' > /tmp/test-lint.ts && bunx biome check /tmp/test-lint.ts; echo "Exit code: $?"`

---

#### Task 8: Set up GitHub Actions CI

**Steps:**

1. [ ] Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]

   jobs:
     check:
       name: Lint, typecheck, test, build
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - uses: oven-sh/setup-bun@v2
           with:
             bun-version: latest

         - name: Install dependencies
           run: bun install --frozen-lockfile

         - name: Lint
           run: bun run lint

         - name: Typecheck
           run: bun run typecheck

         - name: Test
           run: bun test

         - name: Build
           run: bun run build

         - name: Verify Node compatibility
           run: node dist/cli.js --help
   ```

**Verify:** `cat .github/workflows/ci.yml` (CI runs on push, can't test locally, but validate the YAML is correct)

---

#### Task 9: Set up VS Code workspace settings

**Steps:**

1. [ ] Create `.vscode/settings.json`:
   ```json
   {
     "typescript.tsdk": "node_modules/typescript/lib",
     "editor.defaultFormatter": "biomejs.biome",
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "quickfix.biome": "explicit",
       "source.organizeImports.biome": "explicit"
     },
     "[typescript]": {
       "editor.defaultFormatter": "biomejs.biome"
     },
     "[json]": {
       "editor.defaultFormatter": "biomejs.biome"
     },
     "[jsonc]": {
       "editor.defaultFormatter": "biomejs.biome"
     },
     "files.exclude": {
       "**/dist": true,
       "**/node_modules": true
     },
     "search.exclude": {
       "**/dist": true,
       "**/node_modules": true,
       "**/__snapshots__": true
     }
   }
   ```

2. [ ] Create `.vscode/extensions.json`:
   ```json
   {
     "recommendations": [
       "biomejs.biome"
     ]
   }
   ```

3. [ ] Add `engines` field to `package.json` to document minimum Bun version:
   ```json
   "engines": {
     "bun": ">=1.0.0"
   }
   ```

**Verify:** `cat .vscode/settings.json && cat .vscode/extensions.json`

---

### Deferred (add when ready to publish)

These are documented here so we don't forget, but they're not needed until we're shipping releases:

- **Changesets** for version management and changelogs (`bun add --dev @changesets/cli && bunx changeset init`)
- **npm provenance** for package signing (add `provenance=true` to `.npmrc` and configure GitHub OIDC)
- **Dependabot** for dependency updates (enable in GitHub repo Settings > Code Security)
- **Commitlint** for conventional commit enforcement (add via Lefthook when the team grows)

---

## Review Notes

Devil's advocate review caught the following, all incorporated above:
- **Build command was bundling deps**: Changed to `--packages external` so npm dependencies aren't inlined
- **`esModuleInterop` conflicts with `verbatimModuleSyntax`**: Removed `esModuleInterop`
- **`declaration`/`declarationMap`/`sourceMap` are no-ops under `noEmit`**: Removed them
- **`Skill.files` used `Map`**: Changed to `Record<string, string>` for JSON serialization
- **`bun.lock` was gitignored**: Removed from gitignore, lockfile should be committed
- **`lint` script was auto-fixing**: Renamed to `lint` (read-only) and `lint:fix` (auto-fix)
- **`dev` script had trailing `--`**: Removed, users pass `bun run dev -- --help` themselves
- **No `prepublishOnly` script**: Added to ensure build runs before npm publish
- **Biome schema version**: Use actual installed version rather than hardcoding a potentially non-existent version
