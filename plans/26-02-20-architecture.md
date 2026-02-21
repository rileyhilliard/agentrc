# Architecture: agentrc

## TL;DR

A CLI build tool that reads a directory of Markdown files with standardized frontmatter and **transpiles** them into platform-native features for every major AI coding agent. Not a Markdown copier. The differentiator: agentrc understands that a lint-on-save intent is a Claude Code hook in `settings.json`, a Cursor `.mdc` file with globs, and a Copilot scoped `.instructions.md`, and generates the correct native output for each.

The interface is designed to become a standard. If every platform adopted the `.agentrc/` directory structure, the transpiler deletes itself.

## Why This Doesn't Exist Yet

Two tools are in this space. Neither solves the actual problem.

| Tool                     | What It Does                                                                  | What It Doesn't Do                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Ruler** (2.1k stars)   | Copies Markdown to 30+ file paths                                             | No hooks, no glob rules, no skills, no commands, no settings.json. Just file distribution.                                            |
| **ai-rulez** (newer, Go) | YAML → instruction docs for 18+ platforms. Has commands, priorities, presets. | Still generates instruction _documents_, not platform-native _features_. No hooks. No `.mdc` files with frontmatter. No scoped rules. |

The gap: **semantic transpilation**. Understanding developer _intent_ ("lint TypeScript files after edit") and compiling it into the right native feature per platform.

## Goals

1. Define a source format that follows and extends existing conventions (Markdown + YAML frontmatter), so adoption requires minimal learning
2. Transpile to platform-native features, not just Markdown blobs
3. Support glob-scoped contextual rules, lifecycle hooks, commands, and skills
4. Cover all major AI coding platforms with graceful degradation
5. Design the interface so well that platforms could adopt it directly, making the transpiler unnecessary

## Non-Goals

- Runtime enforcement or linting (ai-rulez already does this)
- Being an IDE plugin or GUI editor (ClaudeMDEditor exists for that)
- MCP server config management (Ruler handles this; can add later as an adapter concern)
- Inventing new conventions where existing ones work fine

---

## The Problem In Concrete Terms

You want this behavior: "When editing TypeScript files in `src/components/`, use functional React components with hooks. After any file edit, run `prettier --write` on the changed file."

Today, you manually create:

**Claude Code** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "prettier --write $CLAUDE_FILE_PATHS"
          }
        ]
      }
    ]
  }
}
```

Plus a rule in `CLAUDE.md` or a scoped entry in settings.json for the React convention.

**Cursor** (`.cursor/rules/react-components/RULE.md`):

```markdown
---
description: "React component standards"
globs: "src/components/**/*.tsx"
alwaysApply: false
---

Use functional components with hooks...
```

No native hook equivalent.

**Copilot** (`.github/instructions/react-components.instructions.md`):

```markdown
---
applyTo: "src/components/**/*.tsx"
---

Use functional components with hooks...
```

No hook equivalent.

**Windsurf, Gemini, Codex, etc.**: Each has its own format, most just take Markdown blobs, some support scoping.

That's 4+ files, 3 different syntaxes, different feature sets per platform. One source directory should handle all of it.

---

## Platform Capability Matrix

This is the foundation of the transpiler. Each platform supports a different subset of features. Validated against each platform's current documentation as of February 2026.

| Platform              |           Instructions            |                  Scoped Rules (glob)                   |       Hooks (lifecycle)       |              Commands              |              Skills              |            MCP Config             |
| --------------------- | :-------------------------------: | :----------------------------------------------------: | :---------------------------: | :--------------------------------: | :------------------------------: | :-------------------------------: |
| **Claude Code**       |            `CLAUDE.md`            |             `.claude/settings.json` rules              | `.claude/settings.json` hooks |      `.claude/commands/*.md`       |   `.claude/skills/*/SKILL.md`    |            `.mcp.json`            |
| **Cursor**            |            `AGENTS.md`            |        `.cursor/rules/*/RULE.md` (frontmatter)         |              No               |                 No                 |        `.cursor/skills/`         |        `.cursor/mcp.json`         |
| **Copilot**           | `.github/copilot-instructions.md` | `.github/instructions/**/*.instructions.md` (`applyTo`) |              No               |                 No                 |                No                |        `.vscode/mcp.json`         |
| **Windsurf**          |     `.windsurf/rules/*.md`      |    `.windsurf/rules/*.md` (optional `globs` field)     |              No               | Workflows (`.windsurf/workflows/`) |                No                | `~/.codeium/windsurf/mcp_config.json` |
| **Gemini CLI**        |            `GEMINI.md`            |                           No                           |              No               |                 No                 |                No                |      `.gemini/settings.json`      |
| **Codex (OpenAI)**    |            `AGENTS.md`            |                           No                           |              No               |                 No                 |       `.agents/skills/`        |                No                 |
| **Aider**             |        `CONVENTIONS.md`         |                           No                           |              No               |                 No                 |                No                |                No                 |
| **Cline**             |       `.clinerules/*.md`        |       `.clinerules/*.md` (`paths` frontmatter)       |              No               |                 No                 |    `~/.cline/skills/SKILL.md`    |                No                 |
| **Junie (JetBrains)** |      `.junie/guidelines.md`       |                           No                           |              No               |                 No                 |                No                |                No                 |
| **Amazon Q**          |       `.amazonq/rules/*.md`       |                           No                           |              No               |                 No                 |                No                |        `.amazonq/mcp.json`        |
| **Amp**               |            `AGENTS.md`            |                           No                           |              No               |                 No                 |        `.agents/skills/`         |                No                 |
| **Roo Code**          |            `AGENTS.md`            |          `.roo/rules/` (mode-scoped dirs)            |              No               |                 No                 |          `.roo/skills/`          |          `.roo/mcp.json`          |

**Frontmatter field mapping** (how `globs` translates per platform):

| Platform    | Field Name  | Format                                | Notes                                     |
| ----------- | ----------- | ------------------------------------- | ----------------------------------------- |
| Cursor      | `globs`     | `string \| string[]`                  | Direct match to our source format         |
| Copilot     | `applyTo`   | `string` (comma-separated)            | Rename `globs` → `applyTo`               |
| Windsurf    | `globs`     | `string[]`                            | Same field name, array format             |
| Cline       | `paths`     | `string[]`                            | Rename `globs` → `paths`                 |
| Claude Code | N/A         | Scoping lives in `settings.json`      | Different mechanism entirely              |
| Others      | N/A         | No scoping support                    | Degrade to inline annotation in prose     |

Key insight: **5 platforms now support some form of scoped rules** (Claude Code, Cursor, Copilot, Windsurf, Cline). **Only Claude Code supports hooks.** The transpiler handles graceful degradation: when a platform doesn't support a feature natively, fold it into the instruction document as a best-effort prompt.

### The AGENTS.md Standard

The `AGENTS.md` standard (governed by the Linux Foundation / Agentic AI Foundation, jointly by Google, OpenAI, Factory, Sourcegraph, Cursor) is now supported by Cursor, Windsurf, Cline, Codex, Aider, Gemini CLI, Zed, and others. It provides a universal baseline but only covers basic instructions. It has no frontmatter, no scoping, no hooks, no commands. agentrc is complementary: we generate AGENTS.md as one of our output targets, and our source format is a superset that adds the features AGENTS.md lacks.

---

## The Source Interface

### Design Principle: Follow The Convergence

Every major platform independently arrived at the same pattern: **Markdown files with YAML frontmatter**. Cursor uses `.mdc` files with `globs`/`alwaysApply`/`description`. Copilot uses `.instructions.md` with `applyTo`. Claude Code uses plain `.md` for commands and skills. The emerging `AGENTS.md` standard is just a Markdown file.

The source format should be a **superset of these conventions**, not a departure from them. A directory of Markdown files, organized by concept, with a thin YAML config for non-content settings. If a platform adopted `.agentrc/` natively, the transpiler becomes a no-op for that target.

### Directory Structure

```
.agentrc/
├── config.yaml                    # Project metadata, targets, hooks
├── rules/
│   ├── typescript-strict.md       # alwaysApply rule
│   ├── react-components.md        # glob-scoped rule
│   ├── api-routes.md              # glob-scoped rule
│   └── database-migrations.md     # description-triggered rule
├── commands/
│   ├── test.md                    # slash command
│   └── review.md                  # slash command
└── skills/
    └── debugging/
        └── SKILL.md               # skill with optional supporting files
```

### Rule Files: Markdown + Standardized Frontmatter

The frontmatter schema is a superset of what Cursor and Copilot already use:

```markdown
---
globs:
  - src/components/**/*.tsx
  - src/pages/**/*.tsx
alwaysApply: false
description: "React component standards"
priority: normal
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

**Frontmatter fields:**

| Field         | Type                                        | Required | Description                                                                                                                        |
| ------------- | ------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `globs`       | `string[]`                                  | No       | File patterns that trigger this rule. Follows Cursor's convention. Maps to Copilot's `applyTo`.                                    |
| `alwaysApply` | `boolean`                                   | No       | Always inject into context regardless of files. Default: `false`. If `true`, `globs` are ignored.                                  |
| `description` | `string`                                    | No       | Human-readable description. Used by Cursor for "agent requested" activation (AI decides if rule is relevant based on description). |
| `priority`    | `"critical" \| "high" \| "normal" \| "low"` | No       | Ordering hint. Default: `normal`. Higher priority rules appear earlier in generated output.                                        |

**Activation modes (mirrors Cursor's 4 types):**

| Mode            | Frontmatter                     | Behavior                                  |
| --------------- | ------------------------------- | ----------------------------------------- |
| Always On       | `alwaysApply: true`             | Injected into every interaction           |
| File-Scoped     | `globs: [...]`                  | Active when matching files are in context |
| Agent-Requested | `description: "..."` (no globs) | AI decides based on description relevance |
| Manual          | No frontmatter                  | Only included when explicitly referenced  |

**Why this works as a standard:**

- Cursor adapter: nearly a direct copy (rename file, adjust frontmatter field names if needed)
- Copilot adapter: rename `globs` → `applyTo`, write to `.github/instructions/`
- Claude Code adapter: `alwaysApply` rules go in `CLAUDE.md`, glob rules go in `settings.json`
- Markdown-only platforms: all rules concatenated into a single instruction doc with scope annotations

**Example: always-on rule**

`rules/typescript-strict.md`:

```markdown
---
alwaysApply: true
priority: high
---

Use strict TypeScript. No `any` types.
Prefer interfaces over type aliases for object shapes.
Use explicit return types on exported functions.
```

**Example: description-triggered rule**

`rules/database-migrations.md`:

```markdown
---
description: "Apply when writing or modifying database migrations"
---

Always include a down migration.
Never drop columns in production, deprecate first.
Test migrations against a copy of production data before deploying.
```

### Command Files

`commands/test.md`:

```markdown
---
description: "Run the test suite for the current module"
aliases: [t]
---

Identify the module being worked on from the current file context.
Run `bun test --filter={module}`.
If tests fail, analyze failures and suggest fixes before moving on.
```

Maps to: Claude Code `.claude/commands/test.md`, degraded to instruction doc section for platforms without commands.

### Skill Directories

`skills/debugging/SKILL.md`:

```markdown
---
description: "Systematic debugging methodology"
---

When debugging, follow this process:

1. Reproduce the issue with a minimal test case
2. Read the error message and stack trace carefully
3. Form a hypothesis before changing code
4. Verify the fix doesn't introduce regressions
```

Maps to: Claude Code `.claude/skills/debugging/SKILL.md`, Cursor `.cursor/skills/debugging/`, etc.

### Config File (Non-Content Settings Only)

`config.yaml` handles project metadata and features that are inherently configuration, not content:

```yaml
version: "1"

# Which platforms to generate output for
targets:
  - claude
  - cursor
  - copilot
  - windsurf
  - gemini

# Lifecycle hooks (config, not content — only Claude Code supports natively)
hooks:
  - event: post-edit
    match: "**/*.{ts,tsx}"
    run: "npx prettier --write {file}"
    description: "Auto-format TypeScript files after edit"

  - event: post-edit
    match: "**/*.test.ts"
    run: "npx vitest run {file}"
    description: "Run edited test files"

  - event: pre-commit
    run: "bun run lint && bun run typecheck"
    description: "Lint and typecheck before committing"
```

**Why hooks live in YAML, not Markdown:** Hooks are machine config (event type, glob matcher, shell command). There's no prose content. Putting them in Markdown with frontmatter would be forcing a content format onto something that is purely structural. Hooks are the `settings.json` concern, not the `CLAUDE.md` concern.

**Why identity is NOT a special concept:** The original architecture had a top-level `identity` config. This is just a rule with `alwaysApply: true` and `priority: critical`. Put it in `rules/identity.md`. No need for a special abstraction.

**Why holy_files / context is NOT a special concept:** Reference important files in your rules with `@path/to/file` inline mentions (supported by Claude Code, Cursor, and Copilot). Or create a rule `rules/project-context.md` with `alwaysApply: true` that lists them. The source format shouldn't have special fields for things that rules handle naturally.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Source Layer                          │
│                                                         │
│  .agentrc/                                              │
│  ├── config.yaml        (targets, hooks)                │
│  ├── rules/*.md         (frontmatter + markdown)        │
│  ├── commands/*.md      (frontmatter + markdown)        │
│  └── skills/*/SKILL.md  (skill content)                 │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Parser Layer                          │
│                                                         │
│  Config Parser       Frontmatter Parser   Hook Parser   │
│  (YAML → validated   (gray-matter: parse  (validates    │
│   config object)      each .md file's      hook config   │
│                       frontmatter + body)  and scripts)  │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Intermediate Representation (IR)            │
│                                                         │
│  Normalized, platform-agnostic model of:                │
│  - Rules (scope: always | glob | description | manual)  │
│  - Hooks (event + matcher + command)                    │
│  - Commands (name + description + content)              │
│  - Skills (name + content files)                        │
│  All sorted by priority, validated, resolved.           │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Adapter Layer                          │
│                                                         │
│  Each adapter receives the IR and:                      │
│  1. Maps features to native platform capabilities       │
│  2. Falls back to instruction-doc embedding when the    │
│     platform doesn't support a feature natively         │
│  3. Writes output files in the platform's format        │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Claude   │ │ Cursor   │ │ Copilot  │ │ Windsurf │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Gemini   │ │ Codex    │ │ Aider    │ │ Generic  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Output Layer                           │
│                                                         │
│  .claude/settings.json    .cursor/rules/*/RULE.md       │
│  .claude/commands/*.md    .github/instructions/*.md     │
│  CLAUDE.md                .windsurf/rules/*.md          │
│  GEMINI.md                .clinerules/*.md              │
│  AGENTS.md                .agentrc/.manifest.json       │
│  .gitignore (managed block)                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why This Shape

The IR (intermediate representation) decouples "what the developer wants" from "how each platform expresses it." Same pattern as compilers (source → IR → target). Without it, you end up with N×M mapping (every source feature to every platform), which is what makes this problem hard to solve with scripts.

The adapter layer is where the intelligence lives. Each adapter knows its platform's capabilities and makes decisions:

- Platform supports scoped rules natively? → Generate native scoped rule files
- Platform has no scoping? → Fold the rule into the global instruction doc with "When working on files matching `src/components/**/*.tsx`:"
- Platform supports hooks? → Generate hook config in `settings.json`
- Platform has no hooks? → Add "After editing files, run `prettier --write`" to the instruction doc as a best-effort prompt
- Platform supports commands? → Generate command files
- Platform has no commands? → Add "Available workflows:" section to instruction doc

This degradation strategy means the tool is useful for ALL platforms, even ones with minimal feature sets.

---

## File Ownership Strategy

This is a critical architectural decision. agentrc writes to files that users may already have (like `CLAUDE.md` or `.claude/settings.json`). Clobbering hand-written content would destroy trust immediately.

### The Rule: agentrc Owns What It Generates

Every file agentrc generates gets a header comment marking it as managed:

**Markdown files** (`CLAUDE.md`, `AGENTS.md`, rule files, etc.):
```markdown
<!-- Generated by agentrc vX.Y.Z — edit .agentrc/ instead, changes here will be overwritten -->
```

**JSON files** (`.claude/settings.json`):
```json
{
  "__generated_by": "agentrc@X.Y.Z",
  ...
}
```

### Coexistence with Hand-Written Config

For JSON files like `.claude/settings.json`, agentrc uses **key-level ownership**. It manages specific top-level keys (`hooks` from hook config, scoped rules from rule config) and leaves other keys untouched. The writer reads the existing file, deep-merges only the keys agentrc owns, and writes back. Keys agentrc doesn't generate (like user-added `permissions` or `allowedTools`) are preserved.

For Markdown instruction files (`CLAUDE.md`, `GEMINI.md`, etc.), agentrc owns the entire file. If a user has existing content they want to keep, they should move it into `.agentrc/rules/` with `alwaysApply: true` and let agentrc generate the output. The `agentrc migrate` command helps with this.

For directory-based outputs (`.cursor/rules/`, `.github/instructions/`, `.clinerules/`), agentrc only manages files it created (identified by the generated header). Hand-written files in the same directory are left untouched. `agentrc clean` only removes files with the agentrc header.

### First-Run Safety

On first `agentrc build`, if target files already exist without an agentrc header:
1. Warn the user that existing files will be backed up
2. Create a `.agentrc/.backup/` directory with timestamped copies
3. Suggest running `agentrc migrate` to import existing config
4. Require `--force` flag to overwrite without migration

### Generated File Tracking

agentrc maintains a manifest at `.agentrc/.manifest.json` listing every file it generated, with checksums. This enables:
- `agentrc clean` to know exactly what to remove
- Detection of manual edits to generated files (warn on next build)
- Stale file cleanup when rules are renamed or deleted

---

## Hook Model: Scope and Limitations

The hook abstraction in v1 is intentionally limited to patterns that work well across the Claude Code translation:

### Supported Hook Events

| Event         | Claude Code Mapping        | Description                          |
| ------------- | -------------------------- | ------------------------------------ |
| `post-edit`   | `PostToolUse` (Edit/Write) | After a file is created or modified  |
| `pre-commit`  | `Notification` (Stop)      | Before committing (end of task)      |
| `post-create` | `PostToolUse` (Write)      | After a new file is created          |

### The `{file}` Placeholder

The `{file}` placeholder in hook commands abstracts over platform-specific file path extraction. For Claude Code, the adapter generates the `jq` pipeline to extract the file path from the tool's JSON stdin. Different tools have different JSON shapes:

- `Write` / `Edit`: `.tool_input.file_path`
- `MultiEdit`: `.tool_input.file_path`

The adapter handles this translation. Users write `npx prettier --write {file}` and the adapter generates the correct `jq` pipeline per tool.

### What Hooks Don't Cover

Complex hooks that need to inspect tool output, chain multiple commands conditionally, or interact with Claude Code's prompt-type hooks are out of scope for v1. For those, users should write native `.claude/settings.json` hooks directly and exclude the `claude` target from agentrc's hook generation (or use agentrc for everything else and manually merge the hooks section).

### Degradation Text

When hooks degrade to instructional text for platforms without native support, the adapter generates specific, actionable prose. Not vague suggestions:

- Good: "After editing any `.ts` or `.tsx` file, run `npx prettier --write` on the changed file."
- Bad: "Please format files after editing."

---

## Platform-Specific Concerns

### Windsurf Character Limits

Windsurf enforces 6,000 characters per rule file and 12,000 characters total across all rules. The Windsurf adapter must:

1. Track cumulative character count while generating output
2. Prioritize rules by `priority` field (critical > high > normal > low)
3. If the limit would be exceeded, drop low-priority rules and emit a warning
4. The `inspect` command shows which rules were dropped and why

### Monorepo Support

v1 targets single-project repos. `.agentrc/` lives at the repository root. Monorepo support (nested `.agentrc/` directories, per-package overrides) is a Phase 3 concern. This is documented as a known limitation.

### Glob Pattern Portability

agentrc uses picomatch for glob validation, but each platform has its own glob engine. Patterns should be simple and portable. The validator warns on patterns using advanced features (negation, extglobs, brace expansion) that may not be supported by all target platforms.

---

## Adapter Transpilation Examples

### Claude Code Adapter

The Claude adapter is the most complex because Claude Code has the richest feature set.

**`CLAUDE.md`** (global instruction doc: `alwaysApply` rules + degraded features):

```markdown
Use strict TypeScript. No `any` types.
Prefer interfaces over type aliases for object shapes.
Use explicit return types on exported functions.
```

**`.claude/settings.json`** (hooks from config.yaml + scoped rules):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs -I {} sh -c 'echo {} | grep -qE \"\\.(ts|tsx)$\" && npx prettier --write {}'"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs -I {} sh -c 'echo {} | grep -qE \"\\.test\\.ts$\" && npx vitest run {}'"
          }
        ]
      }
    ]
  }
}
```

**`.claude/commands/test.md`** (direct copy from source):

```markdown
Identify the module being worked on from the current file context.
Run `bun test --filter={module}`.
If tests fail, analyze failures and suggest fixes before moving on.
```

**`.claude/skills/debugging/SKILL.md`** (direct copy from source):

```markdown
When debugging, follow this process...
```

### Cursor Adapter

Nearly a direct mapping. The source format was designed to make this adapter thin.

**`.cursor/rules/typescript-strict/RULE.md`**:

```markdown
---
description: "TypeScript strict mode standards"
globs:
alwaysApply: true
---

Use strict TypeScript. No `any` types.
Prefer interfaces over type aliases for object shapes.
Use explicit return types on exported functions.
```

**`.cursor/rules/react-components/RULE.md`**:

```markdown
---
description: "React component standards"
globs: "src/components/**/*.tsx,src/pages/**/*.tsx"
alwaysApply: false
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

**`.cursor/rules/hooks-degraded/RULE.md`** (hooks folded into a rule):

```markdown
---
description: "Automated formatting and testing conventions"
alwaysApply: true
---

After editing any TypeScript file, run `npx prettier --write` on it.
After editing any test file (\*.test.ts), run `npx vitest run` on it.
Before committing, run `bun run lint && bun run typecheck`.
```

### Copilot Adapter

**`.github/copilot-instructions.md`** (global: `alwaysApply` rules):

```markdown
Use strict TypeScript. No `any` types.
Prefer interfaces over type aliases for object shapes.
Use explicit return types on exported functions.
```

**`.github/instructions/react-components.instructions.md`** (scoped):

```markdown
---
applyTo: "src/components/**/*.tsx,src/pages/**/*.tsx"
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

### Windsurf Adapter

Windsurf now supports multiple rule files with optional glob frontmatter, making it more capable than a pure markdown dump.

**`.windsurf/rules/typescript-strict.md`** (always-on rule):

```markdown
---
globs: []
description: "TypeScript strict mode standards"
---

Use strict TypeScript. No `any` types.
Prefer interfaces over type aliases for object shapes.
Use explicit return types on exported functions.
```

**`.windsurf/rules/react-components.md`** (glob-scoped):

```markdown
---
globs: ["src/components/**/*.tsx", "src/pages/**/*.tsx"]
description: "React component standards"
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

Hooks degrade to instruction text appended to the rules. Commands degrade to a "Workflows" section. Note: Windsurf has a 6,000 character per file / 12,000 total character limit, so the adapter must be mindful of output size.

### Cline Adapter

Cline supports glob-scoped rules via the `paths` frontmatter field and skills via `SKILL.md`.

**`.clinerules/react-components.md`** (glob-scoped):

```markdown
---
paths:
  - "src/components/**/*.tsx"
  - "src/pages/**/*.tsx"
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

Rules without frontmatter are always active. Numeric prefixes (e.g. `01-typescript.md`) control load order.

### Markdown-Only Platforms (Gemini, Aider, Junie, Amazon Q, etc.)

Everything folds into a single instruction doc. Scoped rules become sections with file-path annotations. Hooks become instructional text. Commands become a "Workflows" section. The generic markdown adapter handles all of these with platform-specific file paths.

---

## Tech Stack

### Runtime: Bun

Bun is the runtime, package manager, test runner, and bundler. One tool for everything.

| Concern         | Bun Advantage                                                      |
| --------------- | ------------------------------------------------------------------ |
| Startup         | ~5x faster than Node for CLI tools. `agentrc build` feels instant. |
| Package manager | `bun install` is fast. Lockfile is clean.                          |
| Test runner     | `bun test` is built in. No vitest/jest dependency needed.          |
| TypeScript      | Native TS execution. No compile step needed during development.    |
| Bundling        | `bun build` produces a single-file distributable if needed.        |
| Compatibility   | Runs Commander.js, gray-matter, and the full npm ecosystem.        |

Distribution: `bunx agentrc build` for zero-install Bun users. Publish the package with a Node-compatible build so `npx agentrc build` also works.

### Language: TypeScript (Strict)

The target audience (developers using AI coding agents) overwhelmingly works in TypeScript. Low contribution barrier, excellent JSON/YAML handling, strong typing for the IR and adapter interfaces.

### CLI Framework: Commander.js

Commander is the right tool. The CLI needs subcommands, flags, help text, argument validation. That's it. No TUI, no interactive widgets, no streaming output. Commander handles this in ~50 lines of setup code.

The only interactive moment is `agentrc init`, which uses `@inquirer/prompts` for template selection.

### Key Dependencies

| Package             | Purpose                | Why                                                                               |
| ------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `commander`         | CLI framework          | Industry standard, minimal, stable                                                |
| `gray-matter`       | Frontmatter parsing    | Parse YAML frontmatter from Markdown files. Battle-tested (Jekyll, Hugo, Gatsby). |
| `yaml`              | YAML parsing           | For `config.yaml`. Spec-compliant, good error messages.                           |
| `ajv`               | JSON Schema validation | Validate config.yaml against published schema                                     |
| `picomatch`         | Glob matching          | Fast, spec-compliant glob pattern matching                                        |
| `chalk`             | Terminal output        | Colored CLI output                                                                |
| `@inquirer/prompts` | Interactive prompts    | Only used for `agentrc init` template picker                                      |

Seven dependencies. No framework. Convention over invention.

### Project Structure

```
agentrc/
├── src/
│   ├── cli.ts                      # Commander.js entry point
│   ├── core/
│   │   ├── loader.ts               # Discover + read .agentrc/ directory
│   │   ├── frontmatter.ts          # Parse .md files via gray-matter
│   │   ├── config.ts               # Parse + validate config.yaml via ajv
│   │   └── ir.ts                   # IR types + builder from parsed sources
│   ├── adapters/
│   │   ├── adapter.ts              # Adapter interface contract
│   │   ├── claude.ts               # Claude Code adapter
│   │   ├── cursor.ts               # Cursor adapter
│   │   ├── copilot.ts              # GitHub Copilot adapter
│   │   ├── windsurf.ts             # Windsurf adapter
│   │   ├── cline.ts                # Cline adapter (has scoped rules + skills)
│   │   ├── gemini.ts               # Gemini CLI adapter
│   │   ├── codex.ts                # OpenAI Codex adapter
│   │   ├── generic-markdown.ts     # Fallback adapter for simple platforms
│   │   └── registry.ts             # Adapter lookup by target name
│   ├── output/
│   │   ├── writer.ts               # File writer with backup (.bak) + restore
│   │   └── gitignore.ts            # .gitignore managed block
│   └── commands/                   # CLI command handlers
│       ├── build.ts
│       ├── init.ts
│       ├── validate.ts
│       ├── inspect.ts
│       ├── clean.ts
│       └── migrate.ts
├── schemas/
│   └── agentrc.v1.schema.json      # Published JSON Schema for config.yaml
├── templates/                      # Starter .agentrc/ directories
│   ├── minimal/
│   ├── react-typescript/
│   └── python-fastapi/
├── tests/
│   ├── adapters/                   # Snapshot tests per adapter
│   ├── core/                       # Parser + loader tests
│   └── fixtures/                   # Sample .agentrc/ dirs + expected output
├── package.json
├── tsconfig.json
└── bunfig.toml
```

### Testing Strategy

**Snapshot testing** is the primary pattern. For each adapter:

1. Input: a fixture `.agentrc/` directory
2. Expected output: the exact files the adapter should generate
3. Test: load source → build IR → run adapter → diff output against snapshots

All tests run with `bun test`. No additional test framework dependency.

Additional test types:

- **Schema validation tests**: malformed `config.yaml` files that should fail with clear errors
- **Frontmatter parsing tests**: edge cases in rule files (missing frontmatter, empty globs, etc.)
- **Degradation tests**: verify hooks and commands produce correct instruction-doc fallbacks for markdown-only platforms

---

## CLI Interface

```bash
# Initialize a new .agentrc/ directory (interactive template picker)
agentrc init
agentrc init --template react-typescript

# Build all targets
agentrc build

# Build for specific platforms
agentrc build --targets claude,cursor

# Preview what would be generated (dry run)
agentrc build --dry-run

# Validate .agentrc/ without building
agentrc validate

# Show what a specific platform would receive (native vs degraded)
agentrc inspect claude
agentrc inspect cursor

# Revert all generated files (restores from .bak or deletes)
agentrc clean
```

### The `inspect` Command

This is the UX differentiator. `agentrc inspect claude` shows:

```
Claude Code output:

  NATIVE features:
    ✓ 4 rules (2 always-on → CLAUDE.md, 2 glob-scoped → settings.json)
    ✓ 3 hooks → settings.json (PostToolUse)
    ✓ 2 commands → .claude/commands/
    ✓ 1 skill → .claude/skills/

  Files that would be written:
    CLAUDE.md
    .claude/settings.json
    .claude/commands/test.md
    .claude/commands/review.md
    .claude/skills/debugging/SKILL.md
```

vs `agentrc inspect windsurf`:

```
Windsurf output:

  NATIVE features:
    ✓ 4 rules → .windsurf/rules/rules.md

  DEGRADED features (folded into instruction doc):
    ⚠ 3 hooks → written as behavioral instructions
    ⚠ 2 commands → written as "Workflows" section
    ⚠ 1 skill → written as instruction section
    ⚠ glob scoping → written as file-path annotations

  Files that would be written:
    .windsurf/rules/rules.md
```

This makes the lossy nature of transpilation explicit. Developers know exactly what fidelity they're getting.

---

## Graceful Degradation Strategy

When a platform doesn't support a feature natively, degrade to the best available alternative. Never silently omit features. The `inspect` command makes degradation visible so developers know what fidelity they're getting.

| Feature              | Native Support                                | Degraded Behavior                                                                 |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| Scoped rules (globs) | Claude, Cursor, Copilot, Windsurf, Cline      | Fold into instruction doc with "When working on files matching `{glob}`:" prefix  |
| Hooks                | Claude Code only                              | Fold into instruction doc: "After editing TypeScript files, format with prettier" |
| Commands             | Claude Code only                              | Fold into instruction doc as "Available workflows:" section                       |
| Skills               | Claude, Cursor, Codex, Cline, Amp, Roo        | Fold content into instruction doc as a section                                    |
| Priority ordering    | All (controls output order)                   | Higher priority rules appear earlier in concatenated output                       |

**On hooks specifically:** Claude Code is the only platform with true lifecycle hooks (shell commands that run deterministically on events like PostToolUse). For every other platform, hooks degrade to instructional text. This is a lossy translation: "after editing, run prettier" as a prompt instruction is best-effort, not guaranteed. The `inspect` command flags this clearly so users understand the tradeoff. We never silently drop hooks from the output.

---

## Naming

| Name        | Why It Works                                                                                                                                  | Concerns                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **agentrc** | Unix convention (`.bashrc`, `.vimrc`). "Config for agents." `agentrc build` reads naturally. `.agentrc/` directory is immediately understood. | Slightly generic        |
| **agen**    | Ultra-short. Agent + generate. `agen build`.                                                                                                  | Might be too ambiguous  |
| **drift**   | Short, punchy. Rules "drift" across platforms.                                                                                                | Doesn't say "AI agents" |

**Recommendation: `agentrc`**

The config directory becomes `.agentrc/`, the CLI is `agentrc build`. Every developer who's touched a dotfile rc directory gets it immediately. The name also frames this as infrastructure (like `.npmrc`, `.eslintrc`) rather than a product, which is the right positioning for something that aspires to become a standard.

---

## Tradeoffs and Risks

### Accepting

- **Platform API instability**: Config formats change frequently. Cursor moved from `.cursorrules` to `.mdc` to `RULE.md` folders in under a year. Adapters will need regular updates. Mitigation: snapshot tests catch breakage fast, adapter interface isolates changes.
- **Lossy transpilation**: A Claude Code hook is deterministic (always runs). The degraded version (prompt instruction) is best-effort. The `inspect` command makes this explicit so developers aren't surprised.
- **Bun adoption**: Bun is newer than Node. Some CI environments may not have it. Mitigation: publish a Node-compatible build alongside the Bun-native one. `npx` works as a fallback.

### Risks

- **Platform convergence on AGENTS.md**: If platforms standardize on a single instruction format, the instruction-distribution part of the tool loses value. Counter: hooks, scoped rules, commands, and skills will remain platform-divergent for years. Transpilation of those features is the real value.
- **ai-rulez adds native transpilation**: They could add `.mdc` generation and hook support. Counter: the directory-based Markdown interface is a better DX than their monolithic YAML, and TypeScript's contribution barrier is lower than Go's.
- **Source format doesn't get adopted as a standard**: This is the biggest risk. If no platform adopts `.agentrc/` and the tool remains purely a transpiler, it still provides value but doesn't achieve the aspirational goal. Mitigation: the format is so close to what platforms already use that adoption friction is minimal.

---

## Success Metrics

1. A developer can go from zero to full multi-platform config in under 5 minutes with `agentrc init`
2. Adding a new platform adapter takes under 200 lines of code
3. The generated output for Claude Code and Cursor is indistinguishable from hand-written best-practice configs
4. `agentrc build` completes in under 500ms for typical projects
5. Existing users can migrate their current config into `.agentrc/` with `agentrc migrate` in under 2 minutes

---

## Implementation Order

**Phase 1: Core (MVP)**

1. Project scaffold: `package.json`, `tsconfig.json`, `bunfig.toml`, linting
2. IR types + builder (the normalized model all adapters consume). Define this first because it's the contract between parsers and adapters.
3. `.agentrc/` loader + frontmatter parser (gray-matter)
4. `config.yaml` parser + ajv validation + JSON Schema
5. Adapter interface contract (`Adapter` type + `AdapterResult` type)
6. File writer with key-level JSON merging, Markdown headers, and `.manifest.json` tracking
7. Claude Code adapter (most complex: hooks, scoped rules, commands, skills, `settings.json` merging)
8. Cursor adapter (validates source format maps ~1:1 to Cursor's native format)
9. `build` and `validate` CLI commands
10. Managed `.gitignore` block for generated files
11. `clean` command (revert generated files using manifest)
12. Snapshot test infrastructure + fixtures
13. `agentrc migrate` (basic: import from `.cursor/rules/`, `CLAUDE.md`, `.clinerules/`)

**Phase 2: Breadth**

1. Copilot adapter (scoped rules via `applyTo`)
2. Windsurf adapter (multi-file rules with optional globs, character limit enforcement)
3. Cline adapter (scoped rules via `paths`, skills via `SKILL.md`)
4. Gemini adapter (single GEMINI.md output)
5. Codex adapter (AGENTS.md + `.agents/skills/`)
6. Generic markdown adapter (covers Aider, Junie, Amazon Q, Amp, Roo, etc.)
7. `inspect` command (native vs degraded feature report per platform)
8. `init` command with starter templates

**Phase 3: Polish**

- `--watch` mode (rebuild on `.agentrc/` changes via fs.watch)
- `--dry-run` with diff output (show exactly what would change)
- Pre-commit hook integration (auto-build on commit)
- Monorepo support (nested `.agentrc/` directories)
- Plugin system for community adapters
- `agentrc diff` command (show what changed since last build)
