import type { IR, Rule } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';

/** Sort rules by priority: critical -> high -> normal -> low */
function sortByPriority(rules: Rule[]): Rule[] {
  const order = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...rules].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * GitHub Copilot adapter.
 *
 * Generates:
 * - .github/copilot-instructions.md: all alwaysApply rules by priority
 * - .github/instructions/{name}.instructions.md: glob-scoped rules with applyTo frontmatter
 * - Hooks, commands, and skills all degrade to text in copilot-instructions.md
 */
export const copilotAdapter: Adapter = {
  name: 'copilot',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'scoped-rules'];
    const degradedFeatures: string[] = [];

    const sorted = sortByPriority(ir.rules);
    const mainSections: string[] = [];

    // Always-apply rules go into copilot-instructions.md
    const alwaysRules = sorted.filter((r) => r.scope === 'always' || r.scope === 'manual');
    for (const rule of alwaysRules) {
      mainSections.push(`### ${rule.name}\n\n${rule.content}`);
    }

    // Glob-scoped rules get their own .instructions.md files with applyTo frontmatter
    const globRules = sorted.filter((r) => r.scope === 'glob');
    for (const rule of globRules) {
      const globStr = rule.globs?.join(',') ?? '';
      const frontmatter = `---\napplyTo: "${globStr}"\n---`;
      const content = `${frontmatter}\n\n${rule.content.trim()}\n`;
      files.push({
        path: `.github/instructions/${rule.name}.instructions.md`,
        content,
      });
    }

    // Description-triggered rules degrade to main instructions
    const descRules = sorted.filter((r) => r.scope === 'description');
    if (descRules.length > 0) {
      degradedFeatures.push('description-triggered rules (folded into instructions)');
    }
    for (const rule of descRules) {
      const desc = rule.description ? ` (${rule.description})` : '';
      mainSections.push(`### ${rule.name}${desc}\n\n${rule.content}`);
    }

    // Hooks degrade to text
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
      mainSections.push(hookLines.join('\n'));
    }

    // Commands degrade to text
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
      mainSections.push(cmdLines.join('\n'));
    }

    // Skills degrade to text
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
      mainSections.push(skillLines.join('\n'));
    }

    const mainContent = `${mainSections.join('\n\n').trim()}\n`;
    files.push({ path: '.github/copilot-instructions.md', content: mainContent });

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
