import type { Hook, IR, Rule } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';

/** Sort rules by priority: critical -> high -> normal -> low */
function sortByPriority(rules: Rule[]): Rule[] {
  const order = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...rules].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Convert a glob pattern to a regex pattern for grep -qE.
 * Handles common glob wildcards: *, **, ?
 */
function globToRegex(glob: string): string {
  return glob
    .replace(/\./g, '\\.')
    .replace(/\{([^}]+)\}/g, (_match, group: string) => `(${group.replace(/,/g, '|')})`)
    .replace(/\*\*/g, '.*')
    .replace(/(?<!\.)(\*)(?!\*)/g, '[^/]*')
    .replace(/\?/g, '.');
}

/**
 * Map an IR hook event to Claude Code's hook format.
 * Returns the event name and matcher string for settings.json.
 */
function mapHookEvent(event: Hook['event']): { event: string; matcher: string } {
  switch (event) {
    case 'post-edit':
      return { event: 'PostToolUse', matcher: 'Edit|Write|MultiEdit' };
    case 'post-create':
      return { event: 'PostToolUse', matcher: 'Write' };
    case 'pre-commit':
      return { event: 'Notification', matcher: 'Stop' };
  }
}

/**
 * Build the shell command for a Claude Code hook.
 * Handles {file} placeholder substitution via jq pipeline,
 * hooks/ path resolution, and glob match filtering.
 */
function buildHookCommand(hook: Hook): string {
  let run = hook.run;

  // Resolve hooks/ prefix to .agentrc/hooks/
  if (run.startsWith('hooks/')) {
    run = `.agentrc/${run}`;
  }

  const hasFilePlaceholder = run.includes('{file}');
  const hasMatchGlob = hook.match !== undefined && hook.match !== '';

  if (hasFilePlaceholder) {
    // Use jq pipeline to extract file path and substitute {file} with the resolved path.
    // Use $1 parameter passing to avoid quoting issues with {} inside sh -c.
    let innerCmd = run.replace(/\{file\}/g, '$1');

    if (hasMatchGlob) {
      const regex = globToRegex(hook.match as string);
      innerCmd = `echo "$1" | grep -qE "${regex}" && ${innerCmd}`;
    }

    return `jq -r '.tool_input.file_path' | xargs -I {} sh -c '${innerCmd}' _ {}`;
  }

  if (hasMatchGlob) {
    const regex = globToRegex(hook.match as string);
    return `jq -r '.tool_input.file_path' | xargs -I {} sh -c 'echo "$1" | grep -qE "${regex}" && ${run}' _ {}`;
  }

  return run;
}

/**
 * Claude Code adapter.
 *
 * The most capable adapter, with native support for:
 * - Instructions (CLAUDE.md)
 * - Hooks (.claude/settings.json)
 * - Commands (.claude/commands/*.md)
 * - Skills (.claude/skills/SKILL.md)
 *
 * Scoped (glob-based) rules are included in CLAUDE.md with file-match annotations
 * rather than in settings.json for v1.
 */
export const claudeAdapter: Adapter = {
  name: 'claude',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions'];
    const degradedFeatures: string[] = [];

    // --- CLAUDE.md ---
    const sorted = sortByPriority(ir.rules);
    const mdSections: string[] = [];

    // Always-apply rules (no annotation needed)
    const alwaysRules = sorted.filter((r) => r.scope === 'always');
    for (const rule of alwaysRules) {
      mdSections.push(`### ${rule.name}\n\n${rule.content}`);
    }

    // Manual rules
    const manualRules = sorted.filter((r) => r.scope === 'manual');
    for (const rule of manualRules) {
      mdSections.push(`### ${rule.name}\n\n${rule.content}`);
    }

    // Glob-scoped rules get file-match annotation in CLAUDE.md
    // (not in settings.json for v1)
    const globRules = sorted.filter((r) => r.scope === 'glob');
    if (globRules.length > 0) {
      degradedFeatures.push('scoped-rules (folded into CLAUDE.md with file-match annotations)');
    }
    for (const rule of globRules) {
      const globList = rule.globs?.join(', ') ?? '';
      mdSections.push(
        `### ${rule.name}\n\nWhen working on files matching \`${globList}\`:\n\n${rule.content}`,
      );
    }

    // Description-triggered rules
    const descRules = sorted.filter((r) => r.scope === 'description');
    if (descRules.length > 0) {
      degradedFeatures.push('description-triggered rules (folded into CLAUDE.md)');
    }
    for (const rule of descRules) {
      const desc = rule.description ? ` (${rule.description})` : '';
      mdSections.push(`### ${rule.name}${desc}\n\n${rule.content}`);
    }

    if (mdSections.length > 0) {
      const claudeMdContent = `${mdSections.join('\n\n').trim()}\n`;
      files.push({ path: 'CLAUDE.md', content: claudeMdContent });
    }

    // --- .claude/settings.json ---
    const settingsHooks: Record<string, Array<{ matcher: string; command: string }>> = {};

    if (ir.hooks.length > 0) {
      nativeFeatures.push('hooks');
      for (const hook of ir.hooks) {
        const { event, matcher } = mapHookEvent(hook.event);
        const command = buildHookCommand(hook);

        if (!settingsHooks[event]) {
          settingsHooks[event] = [];
        }
        settingsHooks[event].push({ matcher, command });
      }
    }

    // Only write settings.json if we have hooks
    if (Object.keys(settingsHooks).length > 0) {
      const hooksConfig: Record<string, unknown> = {};

      for (const [event, entries] of Object.entries(settingsHooks)) {
        hooksConfig[event] = entries.map((e) => ({
          matcher: e.matcher,
          hooks: [
            {
              type: 'command',
              command: e.command,
            },
          ],
        }));
      }

      const settings = { hooks: hooksConfig };
      const settingsContent = `${JSON.stringify(settings, null, 2)}\n`;
      files.push({ path: '.claude/settings.json', content: settingsContent });
    }

    // --- .claude/commands/*.md ---
    if (ir.commands.length > 0) {
      nativeFeatures.push('commands');
      for (const cmd of ir.commands) {
        // Direct copy of command content, no frontmatter
        files.push({
          path: `.claude/commands/${cmd.name}.md`,
          content: `${cmd.content.trim()}\n`,
        });
      }
    }

    // --- .claude/skills/*/SKILL.md ---
    if (ir.skills.length > 0) {
      nativeFeatures.push('skills');
      for (const skill of ir.skills) {
        files.push({
          path: `.claude/skills/${skill.name}/SKILL.md`,
          content: `${skill.content.trim()}\n`,
        });

        // Supporting files go in the same directory
        for (const [fileName, fileContent] of Object.entries(skill.files)) {
          files.push({
            path: `.claude/skills/${skill.name}/${fileName}`,
            content: fileContent,
          });
        }
      }
    }

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
