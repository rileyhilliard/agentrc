import type { IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';
import { renderDescriptionRule, renderGlobRule, renderHooksSection } from './shared.ts';

/**
 * Codex (OpenAI) adapter.
 *
 * Generates:
 * - AGENTS.md with all rules (glob-scoped get file-path annotations)
 * - .agents/skills/{name}/SKILL.md for each skill
 * - Hooks degrade to text in AGENTS.md
 */
export const codexAdapter: Adapter = {
  name: 'codex',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'skills'];
    const degradedFeatures: string[] = [];

    const sections: string[] = [];
    const sorted = ir.rules;

    // Always-apply and manual rules
    const alwaysRules = sorted.filter((r) => r.scope === 'always' || r.scope === 'manual');
    for (const rule of alwaysRules) {
      sections.push(`### ${rule.name}\n\n${rule.content}`);
    }

    // Glob-scoped rules with file-path annotations
    const globRules = sorted.filter((r) => r.scope === 'glob');
    if (globRules.length > 0) {
      degradedFeatures.push('scoped-rules (folded into instructions with file-path annotations)');
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

    // Hooks degrade to text
    if (ir.hooks.length > 0) {
      degradedFeatures.push('hooks (folded into behavioral instructions)');
      sections.push(renderHooksSection(ir.hooks));
    }

    const content = `${sections.join('\n\n').trim()}\n`;
    files.push({ path: 'AGENTS.md', content });

    // Skills get native support as .agents/skills/{name}/SKILL.md
    for (const skill of ir.skills) {
      files.push({
        path: `.agents/skills/${skill.name}/SKILL.md`,
        content: `${skill.content.trim()}\n`,
      });

      // Supporting files go in the same directory
      for (const [fileName, fileContent] of Object.entries(skill.files)) {
        files.push({
          path: `.agents/skills/${skill.name}/${fileName}`,
          content: fileContent,
        });
      }
    }

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
