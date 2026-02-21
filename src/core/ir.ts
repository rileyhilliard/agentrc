// IR types: the normalized, platform-agnostic model

import type { LoadedSource } from './loader.ts';

export type RuleScope = 'always' | 'glob' | 'description' | 'manual';
export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface Rule {
  name: string;
  scope: RuleScope;
  content: string;
  globs?: string[];
  description?: string;
  alwaysApply?: boolean;
  priority: Priority;
  sourcePath: string;
}

export interface Hook {
  event: 'post-edit' | 'pre-commit' | 'post-create';
  match?: string;
  run: string;
  description: string;
}

export interface AgentCommand {
  name: string;
  description: string;
  content: string;
  aliases?: string[];
  sourcePath: string;
}

export interface Skill {
  name: string;
  description: string;
  content: string;
  files: Record<string, string>;
  sourcePath: string;
}

export interface IR {
  rules: Rule[];
  hooks: Hook[];
  commands: AgentCommand[];
  skills: Skill[];
  targets: string[];
}

const priorityOrder: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function determineScope(frontmatter: {
  alwaysApply?: boolean;
  globs?: string[];
  description?: string;
}): RuleScope {
  if (frontmatter.alwaysApply) return 'always';
  if (frontmatter.globs && frontmatter.globs.length > 0) return 'glob';
  if (frontmatter.description) return 'description';
  return 'manual';
}

export function buildIR(source: LoadedSource): IR {
  // Convert loaded rules to IR Rules
  const rules: Rule[] = source.rules
    .map((r) => {
      const fm = r.parsed.frontmatter;
      const rule: Rule = {
        name: r.name,
        scope: determineScope(fm),
        content: r.parsed.content,
        priority: fm.priority ?? 'normal',
        sourcePath: r.sourcePath,
      };

      if (fm.globs && fm.globs.length > 0) {
        rule.globs = fm.globs;
      }
      if (fm.description !== undefined) {
        rule.description = fm.description;
      }
      if (fm.alwaysApply !== undefined) {
        rule.alwaysApply = fm.alwaysApply;
      }

      return rule;
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Convert config hooks to IR Hooks (direct mapping)
  const hooks: Hook[] = source.config.hooks;

  // Convert loaded commands to IR AgentCommands
  const commands: AgentCommand[] = source.commands.map((c) => ({
    name: c.name,
    description: c.parsed.frontmatter.description ?? '',
    content: c.parsed.content,
    aliases: c.parsed.frontmatter.aliases,
    sourcePath: c.sourcePath,
  }));

  // Convert loaded skills to IR Skills
  const skills: Skill[] = source.skills.map((s) => ({
    name: s.name,
    description: s.description,
    content: s.content,
    files: s.files,
    sourcePath: s.sourcePath,
  }));

  return {
    rules,
    hooks,
    commands,
    skills,
    targets: source.config.targets,
  };
}
