# Getting started

By the end of this guide, you'll have agentrc installed, a working `.agentrc/` config, and generated platform configs for Claude Code and Cursor. Takes about 5 minutes.

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0 installed

## Step 1: Install agentrc

```bash
bun add -g agentrc
```

Verify it's installed:

```bash
agentrc --version
```

You should see a version number like `0.1.0`.

## Step 2: Initialize your project

Navigate to your project root and run:

```bash
agentrc init
```

This creates a `.agentrc/` directory with two files:

```
.agentrc/
├── config.yaml          # Targets and settings
└── rules/
    └── general.md       # A starter rule
```

The default `config.yaml` targets Claude Code and Cursor:

```yaml
version: "1"
targets:
  - claude
  - cursor
```

## Step 3: Write your first rule

Open `.agentrc/rules/general.md` and replace its content with something useful for your project:

```markdown
---
alwaysApply: true
priority: high
---

Use strict TypeScript. No `any` types.
Prefer interfaces over type aliases for object shapes.
Use explicit return types on exported functions.
```

The frontmatter at the top controls when this rule is active:

- `alwaysApply: true` means this rule is always included in the AI's context.
- `priority: high` means it'll be ordered before normal-priority rules. This matters on platforms with character limits (Windsurf caps rules at 12k characters total).

## Step 4: Add a scoped rule

Not every rule should apply everywhere. Let's add one that only activates when working on React components.

Create `.agentrc/rules/react-components.md`:

```markdown
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

This rule only activates when the AI is editing files that match the glob patterns. The `description` field is used by platforms that support AI-driven rule activation (Cursor uses it for description-triggered rules, Windsurf uses `trigger: model`).

## Step 5: Configure targets

Open `.agentrc/config.yaml` and add any platforms you want to target:

```yaml
version: "1"
targets:
  - claude
  - cursor
  - copilot
```

The full list of supported targets: `claude`, `cursor`, `copilot`, `windsurf`, `cline`, `gemini`, `codex`, `aider`, `junie`, `amazonq`, `amp`, `roo`, `generic-markdown`.

You can also add hooks here. These run as native hooks on Claude Code and degrade to behavioral instructions on other platforms:

```yaml
version: "1"
targets:
  - claude
  - cursor
hooks:
  - event: post-edit
    match: "**/*.{ts,tsx}"
    run: "npx prettier --write {file}"
    description: "Auto-format TypeScript files after edit"
```

## Step 6: Build

```bash
agentrc build
```

You should see output like:

```
Loading .agentrc/ config...

claude:
  ✓ instructions
  ✓ scoped-rules

cursor:
  ✓ instructions
  ✓ scoped-rules

copilot:
  ✓ instructions
  ✓ scoped-rules

✓ Generated 6 files
```

Each platform gets its own native format. Claude Code gets `.claude/rules/*.md`, Cursor gets `.cursor/rules/*.mdc`, and Copilot gets `.github/copilot-instructions.md` plus scoped `.instructions.md` files.

## Step 7: Inspect the output

Use `inspect` to see exactly what a platform receives:

```bash
agentrc inspect claude
```

```
Inspecting output for: claude

Native features:
  ✓ instructions
  ✓ scoped-rules

Files:
  .claude/rules/typescript-strict.md (4 lines)
  .claude/rules/react-components.md (10 lines)
```

Now compare with Cursor:

```bash
agentrc inspect cursor
```

The glob-scoped rule uses different frontmatter (`globs: "src/components/**/*.tsx,..."` instead of `paths:`), because that's what Cursor expects. Same source config, different native output.

## Step 8: Check it in

The generated files are automatically added to your `.gitignore`. You'll see a managed block:

```
# >>> agentrc managed (do not edit) >>>
.claude/rules/typescript-strict.md
.claude/rules/react-components.md
.cursor/rules/typescript-strict.mdc
.cursor/rules/react-components.mdc
# <<< agentrc managed <<<
```

Commit the `.agentrc/` directory (your source of truth). Don't commit the generated files. When another contributor clones the repo, they run `agentrc build` to generate configs for their preferred tools.

```bash
git add .agentrc/
git commit -m "Add agentrc config"
```

## What's next

- Add [commands](configuration.md#command-frontmatter) for reusable workflows (like `/review` or `/test`)
- Add [skills](configuration.md#skill-directories) for multi-file instruction bundles
- Use `agentrc migrate` to [import existing configs](cli.md#migrate) from CLAUDE.md or .cursor/rules/
- See the full [CLI reference](cli.md) for all options
- Check [adapters](adapters.md) for platform-specific details and limitations
