import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { AgentrcConfig } from './config.ts';
import { parseConfig } from './config.ts';
import type { ParsedMarkdown } from './frontmatter.ts';
import { parseFrontmatter } from './frontmatter.ts';

export interface LoadedSource {
  config: AgentrcConfig;
  rules: Array<{ name: string; parsed: ParsedMarkdown; sourcePath: string }>;
  commands: Array<{ name: string; parsed: ParsedMarkdown; sourcePath: string }>;
  skills: Array<{
    name: string;
    description: string;
    content: string;
    files: Record<string, string>;
    sourcePath: string;
  }>;
}

/** Check whether a path exists and is a directory. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/** Read all .md files from a directory, returning parsed results. */
async function loadMarkdownFiles(
  dir: string,
): Promise<Array<{ name: string; parsed: ParsedMarkdown; sourcePath: string }>> {
  if (!(await isDirectory(dir))) return [];

  const entries = await readdir(dir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();

  const results: Array<{ name: string; parsed: ParsedMarkdown; sourcePath: string }> = [];

  for (const file of mdFiles) {
    const filePath = join(dir, file);
    const raw = await readFile(filePath, 'utf-8');
    const parsed = parseFrontmatter(raw);
    const name = basename(file, '.md');
    results.push({ name, parsed, sourcePath: filePath });
  }

  return results;
}

/** Load a single skill directory. Expects SKILL.md as the main file. */
async function loadSkill(
  skillDir: string,
  skillName: string,
): Promise<{
  name: string;
  description: string;
  content: string;
  files: Record<string, string>;
  sourcePath: string;
} | null> {
  const skillMdPath = join(skillDir, 'SKILL.md');

  let skillRaw: string;
  try {
    skillRaw = await readFile(skillMdPath, 'utf-8');
  } catch {
    // No SKILL.md means this isn't a valid skill directory
    return null;
  }

  const { frontmatter, content } = parseFrontmatter(skillRaw);

  // Read any other files in the skill directory as supporting files
  const entries = await readdir(skillDir);
  const files: Record<string, string> = {};

  for (const entry of entries) {
    if (entry === 'SKILL.md') continue;
    const entryPath = join(skillDir, entry);
    const entryStat = await stat(entryPath);
    if (entryStat.isFile()) {
      files[entry] = await readFile(entryPath, 'utf-8');
    }
  }

  return {
    name: skillName,
    description: frontmatter.description ?? '',
    content,
    files,
    sourcePath: skillMdPath,
  };
}

export async function loadAgentrc(rootDir: string): Promise<LoadedSource> {
  const agentrcDir = join(rootDir, '.agentrc');

  // Verify .agentrc/ exists
  if (!(await isDirectory(agentrcDir))) {
    throw new Error(`No .agentrc/ directory found at ${rootDir}`);
  }

  // Read and parse config.yaml (required)
  const configPath = join(agentrcDir, 'config.yaml');
  let configContent: string;
  try {
    configContent = await readFile(configPath, 'utf-8');
  } catch {
    throw new Error('No config.yaml found in .agentrc/');
  }

  const config = parseConfig(configContent);

  // Load rules/*.md
  const rules = await loadMarkdownFiles(join(agentrcDir, 'rules'));

  // Load commands/*.md
  const commands = await loadMarkdownFiles(join(agentrcDir, 'commands'));

  // Load skills/*/SKILL.md
  const skills: LoadedSource['skills'] = [];
  const skillsDir = join(agentrcDir, 'skills');
  if (await isDirectory(skillsDir)) {
    const skillEntries = await readdir(skillsDir);
    const sortedEntries = skillEntries.sort();

    for (const entry of sortedEntries) {
      const entryPath = join(skillsDir, entry);
      if (await isDirectory(entryPath)) {
        const skill = await loadSkill(entryPath, entry);
        if (skill) {
          skills.push(skill);
        }
      }
    }
  }

  return { config, rules, commands, skills };
}
