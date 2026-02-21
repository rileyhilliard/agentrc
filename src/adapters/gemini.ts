import type { IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';
import { pushSkillFiles, renderDescriptionRule, renderGlobRule } from './shared.ts';

/**
 * Gemini CLI adapter.
 *
 * Generates:
 * - GEMINI.md: rules and commands as markdown
 * - .gemini/skills/{name}/SKILL.md: native skill files (Agent Skills open standard)
 */
export const geminiAdapter: Adapter = {
  name: 'gemini',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions'];
    const degradedFeatures: string[] = [];

    const sections: string[] = [];

    // Always-apply and manual rules (no scoping needed)
    const alwaysRules = ir.rules.filter((r) => r.scope === 'always' || r.scope === 'manual');
    for (const rule of alwaysRules) {
      sections.push(`### ${rule.name}\n\n${rule.content}`);
    }

    // Glob-scoped rules with file-match prefix
    const globRules = ir.rules.filter((r) => r.scope === 'glob');
    if (globRules.length > 0) {
      degradedFeatures.push('scoped-rules (folded into instructions with file-match prefix)');
    }
    for (const rule of globRules) {
      sections.push(renderGlobRule(rule));
    }

    // Description-triggered rules
    const descRules = ir.rules.filter((r) => r.scope === 'description');
    if (descRules.length > 0) {
      degradedFeatures.push('description-triggered rules (folded into instructions)');
    }
    for (const rule of descRules) {
      sections.push(renderDescriptionRule(rule));
    }

    // Skills get native support as .gemini/skills/{name}/SKILL.md
    if (ir.skills.length > 0) {
      nativeFeatures.push('skills');
      for (const skill of ir.skills) {
        pushSkillFiles(files, skill, '.gemini');
      }
    }

    const content = `${sections.join('\n\n').trim()}\n`;
    files.push({ path: 'GEMINI.md', content });

    return { files, warnings, nativeFeatures, degradedFeatures };
  },
};
