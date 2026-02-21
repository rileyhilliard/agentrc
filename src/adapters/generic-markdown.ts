import type { IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';
import {
  renderDescriptionRule,
  renderGlobRule,
  renderHooksSection,
  renderSkillsSection,
} from './shared.ts';

/**
 * Factory for generic markdown adapters.
 * These produce a single markdown file with all rules, hooks, and skills folded in.
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

      // Always-apply and manual rules first
      const alwaysRules = ir.rules.filter((r) => r.scope === 'always' || r.scope === 'manual');
      for (const rule of alwaysRules) {
        sections.push(`### ${rule.name}\n\n${rule.content}`);
      }

      // Glob-scoped rules with file-match annotation
      const globRules = ir.rules.filter((r) => r.scope === 'glob');
      if (globRules.length > 0) {
        degradedFeatures.push(
          'scoped-rules (folded into instructions with file-match annotations)',
        );
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

      // Hooks
      if (ir.hooks.length > 0) {
        degradedFeatures.push('hooks (folded into behavioral instructions)');
        sections.push(renderHooksSection(ir.hooks));
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
