import type { Hook, IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';
import { pushSkillFiles } from './shared.ts';

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
 * - Rules (.claude/rules/*.md with optional `paths:` frontmatter)
 * - Hooks (.claude/settings.json)
 * - Commands (.claude/commands/*.md)
 * - Skills (.claude/skills/SKILL.md)
 */
export const claudeAdapter: Adapter = {
  name: 'claude',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions'];
    const degradedFeatures: string[] = [];

    // --- .claude/rules/*.md ---
    const sorted = ir.rules;

    const hasGlobRules = sorted.some((r) => r.scope === 'glob');
    if (hasGlobRules) {
      nativeFeatures.push('scoped-rules');
    }

    const hasDescRules = sorted.some((r) => r.scope === 'description');
    if (hasDescRules) {
      degradedFeatures.push('description-triggered rules (converted to always-on rules)');
    }

    const hasManualRules = sorted.some((r) => r.scope === 'manual');
    if (hasManualRules) {
      degradedFeatures.push('manual rules (converted to always-on rules)');
    }

    for (const rule of sorted) {
      let content: string;

      if (rule.scope === 'glob' && rule.globs && rule.globs.length > 0) {
        const pathsYaml = rule.globs.map((g) => `  - "${g}"`).join('\n');
        content = `---\npaths:\n${pathsYaml}\n---\n\n${rule.content.trim()}\n`;
      } else {
        content = `${rule.content.trim()}\n`;
      }

      files.push({
        path: `.claude/rules/${rule.name}.md`,
        content,
      });
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
        pushSkillFiles(files, skill, '.claude');
      }
    }

    // --- .claude/agents/{name}.md ---
    if (ir.agents.length > 0) {
      nativeFeatures.push('agents');
      for (const agent of ir.agents) {
        const fmLines = [`description: "${agent.description}"`];
        if (agent.model) {
          fmLines.push(`model: ${agent.model}`);
        }
        if (agent.tools && agent.tools.length > 0) {
          fmLines.push('tools:');
          for (const tool of agent.tools) {
            fmLines.push(`  - ${tool}`);
          }
        }
        const frontmatter = `---\n${fmLines.join('\n')}\n---`;
        files.push({
          path: `.claude/agents/${agent.name}.md`,
          content: `${frontmatter}\n\n${agent.content.trim()}\n`,
        });
      }
    }

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
