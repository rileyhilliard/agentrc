import type { Hook } from '../core/ir.ts';

export type DetectedSource = 'claude-standard' | 'claude-plugin' | 'cursor' | 'cline' | null;

export interface ImportedRule {
  filename: string;
  content: string; // Full file content with frontmatter
}

export interface ImportedCommand {
  filename: string;
  content: string;
}

export interface ImportedAgent {
  filename: string;
  content: string;
}

export interface ImportedSkill {
  dirname: string;
  files: Record<string, string>; // relative path -> content
}

export interface ImportedHook {
  event: Hook['event'];
  match?: string;
  run: string;
  description: string;
}

export interface ImportedScript {
  filename: string;
  content: string;
}

export interface ImportResult {
  rules: ImportedRule[];
  commands: ImportedCommand[];
  agents: ImportedAgent[];
  skills: ImportedSkill[];
  hooks: ImportedHook[];
  scripts: ImportedScript[];
  warnings: string[];
  skipped: string[];
}
