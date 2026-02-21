import type { AgentCommand, Hook, IR, Rule, Skill } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';

/** Sort rules by priority: critical -> high -> normal -> low */
function sortByPriority(rules: Rule[]): Rule[] {
  const order = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...rules].sort((a, b) => order[a.priority] - order[b.priority]);
}

/** Render a glob-scoped rule with a file-match prefix */
function renderGlobRule(rule: Rule): string {
  const globList = rule.globs?.join(', ') ?? '';
  return `### ${rule.name}\n\nWhen working on files matching \`${globList}\`:\n\n${rule.content}`;
}

/** Render a description-triggered rule */
function renderDescriptionRule(rule: Rule): string {
  const desc = rule.description ? ` (${rule.description})` : '';
  return `### ${rule.name}${desc}\n\n${rule.content}`;
}

/** Render hooks as behavioral instructions */
function renderHooksSection(hooks: Hook[]): string {
  if (hooks.length === 0) return '';

  const lines = ['## Hooks', ''];
  for (const hook of hooks) {
    const matchInfo = hook.match ? ` on files matching \`${hook.match}\`` : '';
    lines.push(`### ${hook.event}${matchInfo}`);
    lines.push('');
    lines.push(hook.description || `Run: \`${hook.run}\``);
    if (hook.description && hook.run) {
      lines.push('');
      lines.push(`Command: \`${hook.run}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Render commands as a workflows section */
function renderCommandsSection(commands: AgentCommand[]): string {
  if (commands.length === 0) return '';

  const lines = ['## Workflows', ''];
  for (const cmd of commands) {
    const aliases = cmd.aliases?.length ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
    lines.push(`### ${cmd.name}${aliases}`);
    lines.push('');
    if (cmd.description) {
      lines.push(cmd.description);
      lines.push('');
    }
    lines.push(cmd.content);
    lines.push('');
  }
  return lines.join('\n');
}

/** Render skills as a section */
function renderSkillsSection(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const lines = ['## Skills', ''];
  for (const skill of skills) {
    lines.push(`### ${skill.name}`);
    lines.push('');
    if (skill.description) {
      lines.push(skill.description);
      lines.push('');
    }
    lines.push(skill.content);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Factory for generic markdown adapters.
 * These produce a single markdown file with all rules, hooks, commands, and skills folded in.
 */
export function createGenericAdapter(name: string, outputPath: string): Adapter {
  return {
    name,
    generate(ir: IR): AdapterResult {
      const files: OutputFile[] = [];
      const warnings: string[] = [];
      const nativeFeatures: string[] = ['instructions'];
      const degradedFeatures: string[] = [];

      const sections: string[] = [];

      // Rules sorted by priority
      const sorted = sortByPriority(ir.rules);

      // Always-apply and manual rules first
      const alwaysRules = sorted.filter((r) => r.scope === 'always' || r.scope === 'manual');
      for (const rule of alwaysRules) {
        sections.push(`### ${rule.name}\n\n${rule.content}`);
      }

      // Glob-scoped rules with file-match annotation
      const globRules = sorted.filter((r) => r.scope === 'glob');
      if (globRules.length > 0) {
        degradedFeatures.push(
          'scoped-rules (folded into instructions with file-match annotations)',
        );
      }
      for (const rule of globRules) {
        sections.push(renderGlobRule(rule));
      }

      // Description-triggered rules
      const descRules = sorted.filter((r) => r.scope === 'description');
      if (descRules.length > 0) {
        degradedFeatures.push('description-triggered rules (folded into instructions)');
      }
      for (const rule of descRules) {
        sections.push(renderDescriptionRule(rule));
      }

      // Hooks
      if (ir.hooks.length > 0) {
        degradedFeatures.push('hooks (folded into behavioral instructions)');
        sections.push(renderHooksSection(ir.hooks));
      }

      // Commands
      if (ir.commands.length > 0) {
        degradedFeatures.push('commands (folded into workflows section)');
        sections.push(renderCommandsSection(ir.commands));
      }

      // Skills
      if (ir.skills.length > 0) {
        degradedFeatures.push('skills (folded into skills section)');
        sections.push(renderSkillsSection(ir.skills));
      }

      const content = `${sections.join('\n\n').trim()}\n`;
      files.push({ path: outputPath, content });

      return { files, warnings, nativeFeatures, degradedFeatures };
    },
  };
}

export const genericMarkdownAdapter = createGenericAdapter('generic-markdown', 'AGENTS.md');
