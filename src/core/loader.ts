import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { isDirectory } from '../utils.ts';
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
  agents: Array<{ name: string; parsed: ParsedMarkdown; sourcePath: string }>;
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

/** File extensions to skip when collecting skill supporting files. */
const SKIP_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
]);

/** Names to always skip when walking skill directories. */
const SKIP_NAMES = new Set(['SKILL.md', '.DS_Store']);

/**
 * Recursively collect text files from a skill directory into a Record
 * keyed by posix-style relative paths (e.g. "references/advanced-techniques.md").
 */
async function collectSkillFiles(
  baseDir: string,
  currentDir: string,
  files: Record<string, string>,
): Promise<void> {
  const entries = await readdir(currentDir);

  for (const entry of entries) {
    if (SKIP_NAMES.has(entry)) continue;

    const entryPath = join(currentDir, entry);
    const entryStat = await stat(entryPath);

    if (entryStat.isDirectory()) {
      await collectSkillFiles(baseDir, entryPath, files);
    } else if (entryStat.isFile()) {
      // Skip binary files based on extension
      const ext = entry.slice(entry.lastIndexOf('.')).toLowerCase();
      if (ext && SKIP_EXTENSIONS.has(ext)) continue;

      // Use forward-slash relative paths as keys
      const relPath = relative(baseDir, entryPath).split('\\').join('/');
      files[relPath] = await readFile(entryPath, 'utf-8');
    }
  }
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

  // Recursively read all supporting files in the skill directory
  const files: Record<string, string> = {};
  await collectSkillFiles(skillDir, skillDir, files);

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

  // Load agents/*.md
  const agents = await loadMarkdownFiles(join(agentrcDir, 'agents'));

  return { config, rules, commands, skills, agents };
}
