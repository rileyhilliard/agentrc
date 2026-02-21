import type { IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';
import { pushSkillFiles } from './shared.ts';

/**
 * Cursor adapter.
 *
 * Generates:
 * - .cursor/rules/{name}.mdc: one per rule with Cursor-compatible frontmatter
 *   - alwaysApply rules: `alwaysApply: true`
 *   - Glob-scoped: `globs: "glob1,glob2"`, `alwaysApply: false`
 *   - Description-triggered: `description: "..."`, `alwaysApply: false`
 *   - Manual: no special frontmatter
 * - .cursor/commands/{name}.md: one per command (native support)
 * - .cursor/agents/{name}.md: one per agent (native support)
 */
export const cursorAdapter: Adapter = {
  name: 'cursor',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'scoped-rules'];
    const degradedFeatures: string[] = [];

    for (const rule of ir.rules) {
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
        path: `.cursor/rules/${rule.name}.mdc`,
        content,
      });
    }

    // Commands get native support
    if (ir.commands.length > 0) {
      nativeFeatures.push('commands');
      for (const cmd of ir.commands) {
        files.push({
          path: `.cursor/commands/${cmd.name}.md`,
          content: `${cmd.content.trim()}\n`,
        });
      }
    }

    // Skills get native support
    if (ir.skills.length > 0) {
      nativeFeatures.push('skills');
      for (const skill of ir.skills) {
        pushSkillFiles(files, skill, '.cursor');
      }
    }

    // Agents get native support
    if (ir.agents.length > 0) {
      nativeFeatures.push('agents');
      for (const agent of ir.agents) {
        const fmLines: string[] = [];
        if (agent.description) {
          fmLines.push(`description: "${agent.description}"`);
        }
        if (agent.model) {
          fmLines.push(`model: ${agent.model}`);
        }
        const frontmatterBlock = fmLines.length > 0 ? `---\n${fmLines.join('\n')}\n---\n\n` : '';
        files.push({
          path: `.cursor/agents/${agent.name}.md`,
          content: `${frontmatterBlock}${agent.content.trim()}\n`,
        });
      }
    }

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
