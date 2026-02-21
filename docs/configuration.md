# Configuration reference

agentrc reads its configuration from a `.agentrc/` directory in your project root. This doc covers every configuration option.

## Directory structure

```
.agentrc/
├── config.yaml              # Required: targets, hooks, version
├── rules/                   # Markdown files with optional frontmatter
│   ├── typescript-strict.md
│   └── react-components.md
├── commands/                # Slash-command definitions
│   ├── review.md
│   └── test.md
├── skills/                  # Multi-file skill bundles
│   └── debugging/
│       └── SKILL.md
└── agents/                  # Agent definitions
    └── reviewer.md
```

## config.yaml

The only required file. Must contain at least `version: "1"`.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `"1"` | Yes | Schema version. Only `"1"` is supported. |
| `targets` | `string[]` | No | Platforms to generate config for. |
| `hooks` | `object[]` | No | Event-driven automation rules. |

### Targets

The full list of supported target values:

`claude`, `cursor`, `copilot`, `windsurf`, `cline`, `gemini`, `codex`, `aider`, `junie`, `amazonq`, `amp`, `roo`, `generic-markdown`

You can also override targets at build time with `agentrc build --targets claude,cursor`.

### Hooks

Hooks define automated actions that run in response to events. They work natively on Claude Code (via `settings.json` hooks with jq pipelines) and degrade to behavioral instructions on other platforms.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | `string` | Yes | One of: `post-edit`, `pre-commit`, `post-create` |
| `match` | `string` | No | Glob pattern for file matching |
| `run` | `string` | Yes | Shell command to execute |
| `description` | `string` | Yes | Human-readable description of the hook's purpose |

The `{file}` placeholder in the `run` field gets replaced with the actual file path. On Claude Code, this is handled via a jq pipeline that extracts `.tool_input.file_path` from the hook event JSON.

When a `match` glob is specified, the hook only fires for files that match the pattern. On Claude Code, this translates to a `grep -qE` guard in the shell command.

### Complete config.yaml example

```yaml
version: "1"
targets:
  - claude
  - cursor
  - copilot
  - windsurf
  - cline
  - gemini
  - codex
hooks:
  - event: post-edit
    match: "**/*.{ts,tsx}"
    run: "npx prettier --write {file}"
    description: "Auto-format TypeScript files after edit"
  - event: pre-commit
    run: "./scripts/pre-commit-checks.sh"
    description: "Lint and typecheck before committing"
```

## Rule frontmatter

Rules live in `.agentrc/rules/*.md`. Each file is a markdown document with optional YAML frontmatter that controls when the rule is active.

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `globs` | `string \| string[]` | - | File patterns that activate this rule |
| `alwaysApply` | `boolean` | - | If `true`, rule is always active |
| `description` | `string` | - | When the AI should apply this rule |
| `priority` | `"critical" \| "high" \| "normal" \| "low"` | `"normal"` | Controls ordering. Used by Windsurf for truncation. |

### Activation modes

A rule's frontmatter determines its scope. There are four modes:

**Always-on** - Rule is always included in context.

```markdown
---
alwaysApply: true
priority: high
---

Use strict TypeScript. No `any` types.
```

**Glob-scoped** - Rule activates when working on matching files.

```markdown
---
globs:
  - src/components/**/*.tsx
  - src/pages/**/*.tsx
description: "React component standards"
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
```

**Description-triggered** - AI decides when to apply based on the description.

```markdown
---
description: "Apply when writing or modifying database migrations"
---

Always include a down migration.
Never drop columns in production, deprecate first.
```

**Manual (no frontmatter)** - Rule has no activation metadata. On most platforms, this becomes always-on.

```markdown
Follow the project's established code style.
Keep functions small and focused.
```

### Priority ordering

Rules are sorted by priority across all adapters: `critical` > `high` > `normal` > `low`.

This matters most on Windsurf, which enforces character limits (6,000 per file, 12,000 total). When the total limit is exceeded, lower-priority rules get dropped first. Set critical rules to `priority: high` or `priority: critical` so they survive truncation.

### Scope precedence

If multiple scope fields are set, the first match wins:

1. `alwaysApply: true` - always-on
2. `globs` with at least one pattern - glob-scoped
3. `description` set - description-triggered
4. None of the above - manual

## Command frontmatter

Commands live in `.agentrc/commands/*.md`. They define reusable slash commands (like `/review` or `/test`).

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | `string` | `""` | What the command does |
| `aliases` | `string \| string[]` | - | Alternate names for the command |

### Platform support

Commands work natively on Claude Code (`.claude/commands/*.md`) and Cursor (`.cursor/commands/*.md`). Other platforms don't support commands and they are skipped.

### Example

```markdown
---
description: "Run the test suite for the current module"
aliases:
  - t
---

Identify the module being worked on from the current file context.
Run `bun test --filter={module}`.
If tests fail, analyze failures and suggest fixes.
```

## Skill directories

Skills are multi-file bundles that live in `.agentrc/skills/{skill-name}/`. Each skill directory must contain a `SKILL.md` file as its entry point. Any other files in the directory are treated as supporting files.

### SKILL.md frontmatter

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | `string` | `""` | What the skill does |

### Structure

```
.agentrc/skills/debugging/
├── SKILL.md          # Required: entry point with description frontmatter
├── patterns.md       # Optional: supporting files
└── examples.md       # Optional: supporting files
```

### Platform support

Skills get native support on Claude Code (`.claude/skills/`), Cursor (`.cursor/skills/`), Codex (`.agents/skills/`), and Gemini (`.gemini/skills/`). On other platforms, skill content is folded into the main instructions file.

### Example

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

## Agent definitions

Agents live in `.agentrc/agents/*.md`. They define specialized sub-agents with specific models and tool access.

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | `string` | `""` | What the agent does |
| `model` | `string` | - | Model to use (e.g., `sonnet`, `haiku`) |
| `tools` | `string[]` | - | Tools the agent can access |

### Platform support

Agents are supported natively on Claude Code (`.claude/agents/*.md`) and Cursor (`.cursor/agents/*.md`). Other platforms don't have a direct equivalent.

### Example

```markdown
---
description: "Use this agent for code review tasks"
model: sonnet
tools:
  - Read
  - Bash
---

You are a code review specialist. Review code for correctness, style, and potential issues.
```

## Complete example

Here's a full `.agentrc/` setup demonstrating every feature:

```
.agentrc/
├── config.yaml
├── rules/
│   ├── typescript-strict.md    # alwaysApply, priority: high
│   ├── react-components.md     # glob-scoped to *.tsx
│   ├── database-migrations.md  # description-triggered
│   └── code-style.md           # manual (no frontmatter)
├── commands/
│   ├── review.md               # /review command
│   └── test.md                 # /test command (alias: /t)
├── skills/
│   └── debugging/
│       └── SKILL.md            # debugging methodology
└── agents/
    └── reviewer.md             # code review sub-agent
```

Run `agentrc build` and each target platform gets the best possible representation of this config. Claude Code gets native hooks, commands, skills, and agents. Cursor gets `.mdc` files with proper frontmatter. Gemini gets native skills plus everything else folded into `GEMINI.md`. See [adapters](adapters.md) for the full breakdown.
