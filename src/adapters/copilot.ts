import type { IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';
import { renderSkillsSection } from './shared.ts';

/**
 * GitHub Copilot adapter.
 *
 * Generates:
 * - .github/copilot-instructions.md: all alwaysApply rules by priority
 * - .github/instructions/{name}.instructions.md: glob-scoped rules with applyTo frontmatter
 * - Skills degrade to text in copilot-instructions.md
 */
export const copilotAdapter: Adapter = {
  name: 'copilot',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'scoped-rules'];
    const degradedFeatures: string[] = [];

    const mainSections: string[] = [];

    // Always-apply rules go into copilot-instructions.md
    const alwaysRules = ir.rules.filter((r) => r.scope === 'always' || r.scope === 'manual');
    for (const rule of alwaysRules) {
      mainSections.push(`### ${rule.name}\n\n${rule.content}`);
    }

    // Glob-scoped rules get their own .instructions.md files with applyTo frontmatter
    const globRules = ir.rules.filter((r) => r.scope === 'glob');
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
    const descRules = ir.rules.filter((r) => r.scope === 'description');
    if (descRules.length > 0) {
      degradedFeatures.push('description-triggered rules (folded into instructions)');
    }
    for (const rule of descRules) {
      const desc = rule.description ? ` (${rule.description})` : '';
      mainSections.push(`### ${rule.name}${desc}\n\n${rule.content}`);
    }

    // Skills degrade to text
    if (ir.skills.length > 0) {
      degradedFeatures.push('skills (folded into skills section)');
      mainSections.push(renderSkillsSection(ir.skills));
    }

    const mainContent = `${mainSections.join('\n\n').trim()}\n`;
    files.push({ path: '.github/copilot-instructions.md', content: mainContent });

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
