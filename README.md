# agentrc

Configure your AI coding agents once. Transpile to every platform.

## The problem

AI coding tools have no standard configuration format. Claude Code uses `.claude/`, Cursor uses `.cursor/rules/`, Copilot uses `.github/`, Windsurf uses `.windsurf/rules/`, and so on. Each has its own frontmatter, its own scoping mechanisms, and its own limitations for rules, commands, skills, hooks, and agents.

If your team uses multiple tools (or different people prefer different ones), you're stuck maintaining the same configuration in multiple formats. When someone switches from Cursor to Claude Code for a month, they either lose their project context or someone has to manually port the config. Skills, hooks, and commands are even worse since most platforms don't have equivalents at all.

## What agentrc does

agentrc is a transpiler for AI agent configuration. You define your rules, commands, skills, hooks, and agents once in a `.agentrc/` directory, and agentrc generates native config for every platform. Features that a platform supports get the native format. Features it doesn't support degrade gracefully to plain-text instructions.

Two goals:

1. **DRY configuration today.** Your team's coding standards, skills, workflows, and agent definitions live in one place. agentrc handles the translation to whatever formats each person's tool expects. Switch tools, add a new team member on a different editor, or try out a new platform without duplicating or porting config.

2. **A standard worth adopting.** The `.agentrc/` format is designed to be the right interface for agent configuration. If it's good enough, frameworks adopt it directly and this transpiler becomes unnecessary. That's the goal.

## See it in action

Write a scoped rule once:

```markdown
<!-- .agentrc/rules/react-components.md -->
---
globs:
  - src/components/**/*.tsx
  - src/pages/**/*.tsx
description: "React component standards"
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

Run `agentrc build`, and each platform gets its native format:

**Claude Code** (`.claude/rules/react-components.md`):
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

**Cursor** (`.cursor/rules/react-components.mdc`):
```markdown
---
globs: "src/components/**/*.tsx,src/pages/**/*.tsx"
alwaysApply: false
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

**Copilot** (`.github/instructions/react-components.instructions.md`):
```markdown
---
applyTo: "src/components/**/*.tsx,src/pages/**/*.tsx"
---

Use functional components with hooks.
Use Tailwind for styling, no CSS modules.
Every component gets a co-located test file.
```

Same rule, three different native formats. No copy-paste, no drift.

## Quick start

```bash
bun add -g agentrc     # Install
agentrc init           # Create .agentrc/ with starter files
agentrc build          # Generate platform configs
agentrc inspect claude # Preview what Claude Code gets
```

See the [getting started guide](docs/getting-started.md) for a full walkthrough.

## Source format

Your source of truth lives in `.agentrc/`:

```
.agentrc/
├── config.yaml          # Targets, hooks, version
├── rules/               # Markdown rules with frontmatter
│   ├── typescript.md    # alwaysApply: true
│   └── react.md         # globs: ["src/**/*.tsx"]
├── commands/            # Reusable slash commands
│   └── test.md          # /test (alias: /t)
├── skills/              # Multi-file instruction bundles
│   └── debugging/
│       └── SKILL.md
└── agents/              # Sub-agent definitions
    └── reviewer.md
```

**config.yaml** defines your target platforms and hooks:

```yaml
version: "1"
targets:
  - claude
  - cursor
  - copilot
hooks:
  - event: post-edit
    match: "**/*.{ts,tsx}"
    run: "npx prettier --write {file}"
    description: "Auto-format TypeScript files after edit"
```

**Rules** use frontmatter to control activation. Four modes: always-on (`alwaysApply: true`), glob-scoped (`globs: [...]`), description-triggered (`description: "..."`), and manual (no frontmatter).

**Commands** define reusable workflows with optional aliases. Native on Claude Code and Cursor.

**Skills** are multi-file bundles (a `SKILL.md` entry point plus supporting files). Native on Claude Code, Cursor, Codex, and Gemini.

**Agents** define specialized sub-agents with model and tool preferences. Native on Claude Code and Cursor.

See the full [configuration reference](docs/configuration.md).

## Platform support

| Platform | Instructions | Scoped rules | Hooks | Commands | Skills | Agents | Output |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|---|
| Claude Code | native | native | native | native | native | native | `.claude/` |
| Cursor | native | native | - | native | native | native | `.cursor/` |
| Copilot | native | native | - | - | degraded | - | `.github/` |
| Windsurf | native | native | - | - | degraded | - | `.windsurf/rules/` |
| Cline | native | native | - | - | degraded | - | `.clinerules/` |
| Gemini | native | degraded | - | - | native | - | `GEMINI.md` + `.gemini/skills/` |
| Codex | native | degraded | - | - | native | - | `AGENTS.md` + `.agents/skills/` |
| Aider | native | degraded | - | - | degraded | - | `CONVENTIONS.md` |
| Junie | native | degraded | - | - | degraded | - | `.junie/guidelines.md` |
| Amazon Q | native | degraded | - | - | degraded | - | `.amazonq/rules/agentrc.md` |
| Amp | native | degraded | - | - | degraded | - | `AGENTS.md` |
| Roo | native | degraded | - | - | degraded | - | `AGENTS.md` |

- **native** = uses the platform's built-in mechanism.
- **degraded** = folded into text instructions.
- **-** = not supported by the platform, skipped.

See [adapters](docs/adapters.md) for per-platform details.

## CLI commands

| Command | Description |
|---------|-------------|
| `agentrc init` | Create a new `.agentrc/` directory |
| `agentrc build` | Generate platform configs (supports `--targets`, `--dry-run`) |
| `agentrc validate` | Check config for errors |
| `agentrc inspect <platform>` | Preview a platform's output |
| `agentrc clean` | Remove all generated files |
| `agentrc migrate [source-path]` | Import existing configs from .claude/, Claude plugins, .cursor/rules/, .clinerules/ |

See the full [CLI reference](docs/cli.md).

## Documentation

- [Getting started](docs/getting-started.md) - Install to first build in 5 minutes
- [Configuration reference](docs/configuration.md) - config.yaml, frontmatter, commands, skills
- [Adapters](docs/adapters.md) - Per-platform details and support matrix
- [CLI reference](docs/cli.md) - All commands, flags, and examples
- [Architecture](docs/architecture.md) - Pipeline overview and design decisions

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and how to add new adapters.

## License

MIT
