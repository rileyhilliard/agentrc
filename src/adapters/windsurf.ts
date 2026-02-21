import type { IR, Rule } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';

const RULE_CHAR_LIMIT = 6_000;
const TOTAL_CHAR_LIMIT = 12_000;

/** Sort rules by priority: critical -> high -> normal -> low */
function sortByPriority(rules: Rule[]): Rule[] {
  const order = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...rules].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Windsurf adapter.
 *
 * Generates .windsurf/rules/*.md files with Windsurf-compatible frontmatter.
 * Enforces a 6,000 char limit per file and 12,000 char total.
 * Prioritizes higher-priority rules and drops low-priority ones if limits are exceeded.
 *
 * Hooks and commands degrade to a .windsurf/rules/agentrc-conventions.md file.
 */
export const windsurfAdapter: Adapter = {
  name: 'windsurf',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'scoped-rules'];
    const degradedFeatures: string[] = [];

    const sorted = sortByPriority(ir.rules);
    let totalChars = 0;

    for (const rule of sorted) {
      let frontmatter: string;

      if (rule.scope === 'glob' && rule.globs && rule.globs.length > 0) {
        const globsYaml = rule.globs.map((g) => `  - "${g}"`).join('\n');
        frontmatter = `---\ntrigger: glob\nglobs:\n${globsYaml}\n---`;
      } else {
        // alwaysApply, manual, description-triggered all become always_on
        frontmatter = '---\ntrigger: always_on\n---';
      }

      const content = `${frontmatter}\n\n${rule.content.trim()}\n`;
      const charCount = content.length;

      // Check per-file limit
      if (charCount > RULE_CHAR_LIMIT) {
        warnings.push(
          `Rule "${rule.name}" is ${charCount} chars, exceeding Windsurf's ${RULE_CHAR_LIMIT}-char per-file limit. It will be truncated by Windsurf.`,
        );
      }

      // Check total limit
      if (totalChars + charCount > TOTAL_CHAR_LIMIT) {
        warnings.push(
          `Dropping rule "${rule.name}" (priority: ${rule.priority}): would exceed Windsurf's ${TOTAL_CHAR_LIMIT}-char total limit (current: ${totalChars} chars).`,
        );
        continue;
      }

      totalChars += charCount;
      files.push({
        path: `.windsurf/rules/${rule.name}.md`,
        content,
      });
    }

    // Description-triggered rules get folded since Windsurf doesn't support description triggers
    const descRules = sorted.filter((r) => r.scope === 'description');
    if (descRules.length > 0) {
      degradedFeatures.push('description-triggered rules (converted to always_on)');
    }

    // Degrade hooks and commands into a conventions file
    const conventionSections: string[] = [];

    if (ir.hooks.length > 0) {
      degradedFeatures.push('hooks (folded into conventions file)');
      conventionSections.push('## Hooks');
      conventionSections.push('');
      for (const hook of ir.hooks) {
        const matchInfo = hook.match ? ` on files matching \`${hook.match}\`` : '';
        conventionSections.push(`### ${hook.event}${matchInfo}`);
        conventionSections.push('');
        conventionSections.push(hook.description || `Run: \`${hook.run}\``);
        if (hook.description && hook.run) {
          conventionSections.push('');
          conventionSections.push(`Command: \`${hook.run}\``);
        }
        conventionSections.push('');
      }
    }

    if (ir.commands.length > 0) {
      degradedFeatures.push('commands (folded into conventions file)');
      conventionSections.push('## Workflows');
      conventionSections.push('');
      for (const cmd of ir.commands) {
        const aliases = cmd.aliases?.length ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
        conventionSections.push(`### ${cmd.name}${aliases}`);
        conventionSections.push('');
        if (cmd.description) {
          conventionSections.push(cmd.description);
          conventionSections.push('');
        }
        conventionSections.push(cmd.content);
        conventionSections.push('');
      }
    }

    if (ir.skills.length > 0) {
      degradedFeatures.push('skills (folded into conventions file)');
      conventionSections.push('## Skills');
      conventionSections.push('');
      for (const skill of ir.skills) {
        conventionSections.push(`### ${skill.name}`);
        conventionSections.push('');
        if (skill.description) {
          conventionSections.push(skill.description);
          conventionSections.push('');
        }
        conventionSections.push(skill.content);
        conventionSections.push('');
      }
    }

    if (conventionSections.length > 0) {
      const convContent = `---\ntrigger: always_on\n---\n\n${conventionSections.join('\n').trim()}\n`;
      const convCharCount = convContent.length;

      if (totalChars + convCharCount > TOTAL_CHAR_LIMIT) {
        warnings.push(
          `Conventions file (hooks/commands/skills) would exceed Windsurf's ${TOTAL_CHAR_LIMIT}-char total limit. Some degraded content may be truncated.`,
        );
      }

      files.push({
        path: '.windsurf/rules/agentrc-conventions.md',
        content: convContent,
      });
    }

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
