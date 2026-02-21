import type { IR, Rule } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';

/** Sort rules by priority: critical -> high -> normal -> low */
function sortByPriority(rules: Rule[]): Rule[] {
  const order = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...rules].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Gemini CLI adapter.
 *
 * Simplest adapter: everything goes into a single GEMINI.md file.
 * Rules sorted by priority, glob-scoped rules get file-match prefixes,
 * hooks become behavioral instructions, commands become a workflows section.
 */
export const geminiAdapter: Adapter = {
  name: 'gemini',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions'];
    const degradedFeatures: string[] = [];

    const sections: string[] = [];
    const sorted = sortByPriority(ir.rules);

    // Always-apply and manual rules (no scoping needed)
    const alwaysRules = sorted.filter((r) => r.scope === 'always' || r.scope === 'manual');
    for (const rule of alwaysRules) {
      sections.push(`### ${rule.name}\n\n${rule.content}`);
    }

    // Glob-scoped rules with file-match prefix
    const globRules = sorted.filter((r) => r.scope === 'glob');
    if (globRules.length > 0) {
      degradedFeatures.push('scoped-rules (folded into instructions with file-match prefix)');
    }
    for (const rule of globRules) {
      const globList = rule.globs?.join(', ') ?? '';
      sections.push(
        `### ${rule.name}\n\nWhen working on files matching \`${globList}\`:\n\n${rule.content}`,
      );
    }

    // Description-triggered rules
    const descRules = sorted.filter((r) => r.scope === 'description');
    if (descRules.length > 0) {
      degradedFeatures.push('description-triggered rules (folded into instructions)');
    }
    for (const rule of descRules) {
      const desc = rule.description ? ` (${rule.description})` : '';
      sections.push(`### ${rule.name}${desc}\n\n${rule.content}`);
    }

    // Hooks become behavioral instructions
    if (ir.hooks.length > 0) {
      degradedFeatures.push('hooks (folded into behavioral instructions)');
      const hookLines = ['## Hooks', ''];
      for (const hook of ir.hooks) {
        const matchInfo = hook.match ? ` on files matching \`${hook.match}\`` : '';
        hookLines.push(`### ${hook.event}${matchInfo}`);
        hookLines.push('');
        hookLines.push(hook.description || `Run: \`${hook.run}\``);
        if (hook.description && hook.run) {
          hookLines.push('');
          hookLines.push(`Command: \`${hook.run}\``);
        }
        hookLines.push('');
      }
      sections.push(hookLines.join('\n'));
    }

    // Commands become workflows section
    if (ir.commands.length > 0) {
      degradedFeatures.push('commands (folded into workflows section)');
      const cmdLines = ['## Workflows', ''];
      for (const cmd of ir.commands) {
        const aliases = cmd.aliases?.length ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
        cmdLines.push(`### ${cmd.name}${aliases}`);
        cmdLines.push('');
        if (cmd.description) {
          cmdLines.push(cmd.description);
          cmdLines.push('');
        }
        cmdLines.push(cmd.content);
        cmdLines.push('');
      }
      sections.push(cmdLines.join('\n'));
    }

    // Skills become documentation section
    if (ir.skills.length > 0) {
      degradedFeatures.push('skills (folded into skills section)');
      const skillLines = ['## Skills', ''];
      for (const skill of ir.skills) {
        skillLines.push(`### ${skill.name}`);
        skillLines.push('');
        if (skill.description) {
          skillLines.push(skill.description);
          skillLines.push('');
        }
        skillLines.push(skill.content);
        skillLines.push('');
      }
      sections.push(skillLines.join('\n'));
    }

    const content = `${sections.join('\n\n').trim()}\n`;
    files.push({ path: 'GEMINI.md', content });

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
