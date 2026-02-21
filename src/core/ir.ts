// IR types: the normalized, platform-agnostic model

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
