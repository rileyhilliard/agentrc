import type { IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';

/**
 * Cline adapter.
 *
 * Generates:
 * - .clinerules/{NN}-{name}.md: rule files with numeric prefixes for priority ordering
 *   - Glob-scoped rules use `paths` frontmatter
 *   - Rules without globs have no frontmatter (always active)
 * - .clinerules/00-agentrc-conventions.md: degraded hooks and skills
 */
export const clineAdapter: Adapter = {
  name: 'cline',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'scoped-rules'];
    const degradedFeatures: string[] = [];

    const sorted = ir.rules;

    // Assign numeric prefixes starting at 01 (00 reserved for conventions)
    let index = 1;
    for (const rule of sorted) {
      const prefix = String(index).padStart(2, '0');
      let content: string;

      if (rule.scope === 'glob' && rule.globs && rule.globs.length > 0) {
        // Glob-scoped rules get paths frontmatter
        const pathsYaml = rule.globs.map((g) => `  - "${g}"`).join('\n');
        content = `---\npaths:\n${pathsYaml}\n---\n\n${rule.content.trim()}\n`;
      } else {
        // All other rules: no frontmatter, always active in Cline
        content = `${rule.content.trim()}\n`;
      }

      files.push({
        path: `.clinerules/${prefix}-${rule.name}.md`,
        content,
      });
      index++;
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
      files.push({
        path: '.clinerules/00-agentrc-conventions.md',
        content: `${conventionSections.join('\n').trim()}\n`,
      });
    }

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
