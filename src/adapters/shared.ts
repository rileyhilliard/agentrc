import type { Rule, Skill } from '../core/ir.ts';
import type { OutputFile } from './adapter.ts';

/** Render a glob-scoped rule with a file-match prefix */
export function renderGlobRule(rule: Rule): string {
  const globList = rule.globs?.join(', ') ?? '';
  return `### ${rule.name}\n\nWhen working on files matching \`${globList}\`:\n\n${rule.content}`;
}

/** Render a description-triggered rule */
export function renderDescriptionRule(rule: Rule): string {
  const desc = rule.description ? ` (${rule.description})` : '';
  return `### ${rule.name}${desc}\n\n${rule.content}`;
}

/** Render skills as a section */
export function renderSkillsSection(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const lines = ['## Skills', ''];
  for (const skill of skills) {
    lines.push(`### ${skill.name}`);
    lines.push('');
    if (skill.description) {
      lines.push(skill.description);
      lines.push('');
    }
    lines.push(skill.content);
    lines.push('');
  }
  return lines.join('\n');
}

/** Push SKILL.md + supporting files for a skill into an OutputFile array */
export function pushSkillFiles(files: OutputFile[], skill: Skill, prefix: string): void {
  files.push({
    path: `${prefix}/skills/${skill.name}/SKILL.md`,
    content: `${skill.content.trim()}\n`,
  });

  for (const [fileName, fileContent] of Object.entries(skill.files)) {
    files.push({
      path: `${prefix}/skills/${skill.name}/${fileName}`,
      content: fileContent,
    });
  }
}
