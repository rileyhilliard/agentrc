import type { IR, Rule } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';

/** Sort rules by priority: critical -> high -> normal -> low */
function sortByPriority(rules: Rule[]): Rule[] {
  const order = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...rules].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Cursor adapter.
 *
 * Generates:
 * - .cursor/rules/{name}/RULE.md: one per rule with Cursor-compatible frontmatter
 *   - alwaysApply rules: `alwaysApply: true`
 *   - Glob-scoped: `globs: "glob1,glob2"`, `alwaysApply: false`
 *   - Description-triggered: `description: "..."`, `alwaysApply: false`
 *   - Manual: no special frontmatter
 * - .cursor/rules/agentrc-hooks/RULE.md: degraded hooks as behavioral instructions
 * - .cursor/rules/agentrc-commands/RULE.md: degraded commands
 */
export const cursorAdapter: Adapter = {
  name: 'cursor',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'scoped-rules'];
    const degradedFeatures: string[] = [];

    const sorted = sortByPriority(ir.rules);

    for (const rule of sorted) {
      let frontmatter: string;

      switch (rule.scope) {
        case 'always':
          frontmatter = '---\nalwaysApply: true\n---';
          break;
        case 'glob': {
          const globStr = rule.globs?.join(',') ?? '';
          frontmatter = `---\nglobs: "${globStr}"\nalwaysApply: false\n---`;
          break;
        }
        case 'description': {
          const desc = rule.description ?? rule.name;
          frontmatter = `---\ndescription: "${desc}"\nalwaysApply: false\n---`;
          break;
        }
        case 'manual':
          frontmatter = '---\nalwaysApply: false\n---';
          break;
      }

      const content = `${frontmatter}\n\n${rule.content.trim()}\n`;
      files.push({
        path: `.cursor/rules/${rule.name}/RULE.md`,
        content,
      });
    }

    // Hooks degrade to a behavioral instructions rule
    if (ir.hooks.length > 0) {
      degradedFeatures.push('hooks (folded into behavioral instructions rule)');
      const hookLines = ['# Hooks', '', 'Follow these behavioral rules for hooks:', ''];
      for (const hook of ir.hooks) {
        const matchInfo = hook.match ? ` on files matching \`${hook.match}\`` : '';
        hookLines.push(`## ${hook.event}${matchInfo}`);
        hookLines.push('');
        hookLines.push(hook.description || `Run: \`${hook.run}\``);
        if (hook.description && hook.run) {
          hookLines.push('');
          hookLines.push(`Command: \`${hook.run}\``);
        }
        hookLines.push('');
      }

      files.push({
        path: '.cursor/rules/agentrc-hooks/RULE.md',
        content: `---\nalwaysApply: true\n---\n\n${hookLines.join('\n').trim()}\n`,
      });
    }

    // Commands degrade to a description-triggered rule
    if (ir.commands.length > 0) {
      degradedFeatures.push('commands (folded into description-triggered rule)');
      const cmdLines = ['# Available Commands and Workflows', ''];
      for (const cmd of ir.commands) {
        const aliases = cmd.aliases?.length ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
        cmdLines.push(`## ${cmd.name}${aliases}`);
        cmdLines.push('');
        if (cmd.description) {
          cmdLines.push(cmd.description);
          cmdLines.push('');
        }
        cmdLines.push(cmd.content);
        cmdLines.push('');
      }

      files.push({
        path: '.cursor/rules/agentrc-commands/RULE.md',
        content: `---\ndescription: "Available commands and workflows"\nalwaysApply: false\n---\n\n${cmdLines.join('\n').trim()}\n`,
      });
    }

    // Skills get native support
    if (ir.skills.length > 0) {
      nativeFeatures.push('skills');
      for (const skill of ir.skills) {
        files.push({
          path: `.cursor/skills/${skill.name}/SKILL.md`,
          content: `${skill.content.trim()}\n`,
        });

        // Supporting files
        for (const [fileName, fileContent] of Object.entries(skill.files)) {
          files.push({
            path: `.cursor/skills/${skill.name}/${fileName}`,
            content: fileContent,
          });
        }
      }
    }

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
