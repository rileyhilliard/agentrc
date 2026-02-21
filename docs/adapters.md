# Adapters

Each adapter translates agentrc's intermediate representation into the format a specific platform expects. Some features translate directly (native), some get folded into text instructions (degraded), and some aren't representable at all.

## Feature support matrix

| Platform | Instructions | Scoped rules | Hooks | Commands | Skills | Agents | Output path |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|---|
| Claude Code | native | native | native | native | native | native | `.claude/` |
| Cursor | native | native | degraded | native | native | native | `.cursor/` |
| Copilot | native | native | degraded | - | degraded | - | `.github/` |
| Windsurf | native | native | degraded | - | degraded | - | `.windsurf/rules/` |
| Cline | native | native | degraded | - | degraded | - | `.clinerules/` |
| Gemini | native | degraded | degraded | - | native | - | `GEMINI.md` + `.gemini/skills/` |
| Codex | native | degraded | degraded | - | native | - | `AGENTS.md` + `.agents/skills/` |
| Aider | native | degraded | degraded | - | degraded | - | `CONVENTIONS.md` |
| Junie | native | degraded | degraded | - | degraded | - | `.junie/guidelines.md` |
| Amazon Q | native | degraded | degraded | - | degraded | - | `.amazonq/rules/agentrc.md` |
| Amp | native | degraded | degraded | - | degraded | - | `AGENTS.md` |
| Roo | native | degraded | degraded | - | degraded | - | `AGENTS.md` |

## How degradation works

**Native** means the platform has a built-in mechanism for that feature. agentrc outputs it in the platform's expected format and the feature works as intended.

**Degraded** means the platform doesn't have a dedicated mechanism, so agentrc folds the content into plain-text instructions. The AI still sees the information, but it's treated as guidance rather than enforced behavior. For example, hooks degrade to "when you edit a TypeScript file, run prettier" as a behavioral instruction instead of an actual automated hook.

**-** means the platform doesn't support this concept at all, so it's skipped entirely. No degraded output is generated.

## Platform details

### Claude Code

The most capable target. Every agentrc feature maps to a native Claude Code concept.

**Output files:**
- `.claude/rules/{name}.md` - One per rule. Glob-scoped rules get `paths:` frontmatter.
- `.claude/settings.json` - Hook definitions with jq pipelines and glob matching.
- `.claude/commands/{name}.md` - One per command. Content only, no frontmatter.
- `.claude/skills/{name}/SKILL.md` - Skill bundles with supporting files.
- `.claude/agents/{name}.md` - Agent definitions with frontmatter for model and tools.

**Hook translation:** Hooks use Claude Code's `settings.json` hook system. The `{file}` placeholder is resolved via a `jq -r '.tool_input.file_path'` pipeline piped to `xargs`. Glob `match` patterns are converted to regex for `grep -qE` guards.

Hook events map as follows:

| agentrc event | Claude Code event | Matcher |
|---------------|-------------------|---------|
| `post-edit` | `PostToolUse` | `Edit\|Write\|MultiEdit` |
| `post-create` | `PostToolUse` | `Write` |
| `pre-commit` | `Notification` | `Stop` |

**JSON merge behavior:** If `.claude/settings.json` already exists and doesn't have an agentrc generated header, the adapter deep-merges its hook config into the existing file (and backs up the original). If it does have the header, the file is overwritten entirely.

**Scope handling:**
- `alwaysApply` rules: plain content, no frontmatter
- `glob` rules: `paths:` frontmatter with the glob patterns
- `description` rules: degraded to always-on (Claude Code doesn't natively support description triggers)
- `manual` rules: degraded to always-on

### Cursor

Generates `.cursor/rules/{name}.mdc` files with Cursor-specific frontmatter.

**Output files:**
- `.cursor/rules/{name}.mdc` - One per rule with Cursor frontmatter.
- `.cursor/rules/agentrc-hooks.mdc` - Degraded hooks as an always-on behavioral rule.
- `.cursor/commands/{name}.md` - One per command (native support).
- `.cursor/skills/{name}/SKILL.md` - Skill bundles (native support).
- `.cursor/agents/{name}.md` - Agent definitions with description and model frontmatter (native support).

**Scope handling:**
- `alwaysApply` rules: `alwaysApply: true` frontmatter
- `glob` rules: `globs: "glob1,glob2"` frontmatter with `alwaysApply: false`
- `description` rules: `description: "..."` frontmatter with `alwaysApply: false`
- `manual` rules: `alwaysApply: false`

### Copilot

Uses GitHub Copilot's instructions system with `applyTo` for glob scoping.

**Output files:**
- `.github/copilot-instructions.md` - Always-on rules, degraded hooks and skills.
- `.github/instructions/{name}.instructions.md` - Glob-scoped rules with `applyTo:` frontmatter.

**Scope handling:**
- `alwaysApply` and `manual` rules: folded into `copilot-instructions.md`
- `glob` rules: separate `.instructions.md` file with `applyTo: "glob1,glob2"` frontmatter
- `description` rules: folded into `copilot-instructions.md` with description annotation

### Windsurf

Generates `.windsurf/rules/*.md` with Windsurf's `trigger` frontmatter system. The key thing about Windsurf is its character limits.

**Limits:**
- 6,000 characters per rule file
- 12,000 characters total across all rules

When the total character limit is exceeded, lower-priority rules are dropped. The adapter processes rules in priority order (`critical` > `high` > `normal` > `low`), so higher-priority rules always survive.

**Output files:**
- `.windsurf/rules/{name}.md` - One per rule (until limits are hit).
- `.windsurf/rules/agentrc-conventions.md` - Degraded hooks and skills.

**Scope handling:**
- `alwaysApply` and `manual` rules: `trigger: always_on`
- `glob` rules: `trigger: glob` with `globs:` list
- `description` rules: `trigger: model` with `description:` (native support)

### Cline

Uses `.clinerules/` directory with numeric-prefix ordering for priority.

**Output files:**
- `.clinerules/{NN}-{name}.md` - Numbered files starting at `01`, priority-sorted.
- `.clinerules/00-agentrc-conventions.md` - Degraded hooks and skills.

**Scope handling:**
- `glob` rules: `paths:` frontmatter (Cline's equivalent of `globs:`)
- All other rules: no frontmatter (always active in Cline)

### Gemini

Rules and hooks go into `GEMINI.md`. Skills get native support via `.gemini/skills/` (Gemini CLI implements the Agent Skills open standard).

**Output files:**
- `GEMINI.md` - All rules and degraded hooks.
- `.gemini/skills/{name}/SKILL.md` - Skill bundles with supporting files (native support).

**Scope handling:**
- `alwaysApply` and `manual` rules: direct content
- `glob` rules: prefixed with "When working on files matching `pattern`:"
- `description` rules: name annotated with description
- Hooks: folded into `GEMINI.md` as a section

### Codex

OpenAI's Codex uses `AGENTS.md` for instructions and `.agents/skills/` for skill bundles.

**Output files:**
- `AGENTS.md` - All rules and degraded hooks.
- `.agents/skills/{name}/SKILL.md` - Skill bundles with supporting files (native support).

**Scope handling:**
- `alwaysApply` and `manual` rules: direct content
- `glob` rules: prefixed with "When working on files matching `pattern`:"
- `description` rules: name annotated with description

### Generic markdown platforms

Aider, Junie, Amazon Q, Amp, and Roo all use the same generic adapter pattern. Everything is folded into a single markdown file. The only difference is the output path.

| Platform | Output path |
|----------|-------------|
| Aider | `CONVENTIONS.md` |
| Junie | `.junie/guidelines.md` |
| Amazon Q | `.amazonq/rules/agentrc.md` |
| Amp | `AGENTS.md` |
| Roo | `AGENTS.md` |

All features except basic instructions are degraded. Glob-scoped rules get "When working on files matching" annotations. Hooks become behavioral instructions. Skills become a skills section.

## Writing a custom adapter

See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-new-adapter) for a step-by-step guide on adding new adapters.
