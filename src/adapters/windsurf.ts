import type { IR } from '../core/ir.ts';
import type { Adapter, AdapterResult, OutputFile } from './adapter.ts';
import { inlineSkillContent } from './shared.ts';

const RULE_CHAR_LIMIT = 6_000;
const TOTAL_CHAR_LIMIT = 12_000;

/**
 * Windsurf adapter.
 *
 * Generates .windsurf/rules/*.md files with Windsurf-compatible frontmatter.
 * Enforces a 6,000 char limit per file and 12,000 char total.
 * Prioritizes higher-priority rules and drops low-priority ones if limits are exceeded.
 *
 * Skills degrade to a .windsurf/rules/agentrc-conventions.md file.
 */
export const windsurfAdapter: Adapter = {
  name: 'windsurf',
  generate(ir: IR): AdapterResult {
    const files: OutputFile[] = [];
    const warnings: string[] = [];
    const nativeFeatures: string[] = ['instructions', 'scoped-rules'];
    const degradedFeatures: string[] = [];

    let totalChars = 0;

    for (const rule of ir.rules) {
      let frontmatter: string;

      if (rule.scope === 'glob' && rule.globs && rule.globs.length > 0) {
        const globsYaml = rule.globs.map((g) => `  - "${g}"`).join('\n');
        frontmatter = `---\ntrigger: glob\nglobs:\n${globsYaml}\n---`;
      } else if (rule.scope === 'description' && rule.description) {
        // Description-triggered rules use model decision trigger
        frontmatter = `---\ntrigger: model\ndescription: "${rule.description}"\n---`;
      } else {
        // alwaysApply, manual all become always_on
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

    // Description-triggered rules use trigger: model natively
    const descRules = ir.rules.filter((r) => r.scope === 'description');
    if (descRules.length > 0) {
      nativeFeatures.push('description-triggered-rules');
    }

    // Degrade skills into a conventions file
    const conventionSections: string[] = [];

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
        conventionSections.push(inlineSkillContent(skill));
        conventionSections.push('');
      }
    }

    if (conventionSections.length > 0) {
      const convContent = `---\ntrigger: always_on\n---\n\n${conventionSections.join('\n').trim()}\n`;
      const convCharCount = convContent.length;

      if (totalChars + convCharCount > TOTAL_CHAR_LIMIT) {
        warnings.push(
          `Conventions file (skills) would exceed Windsurf's ${TOTAL_CHAR_LIMIT}-char total limit. Some degraded content may be truncated.`,
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
