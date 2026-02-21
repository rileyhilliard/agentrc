import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import chalk from 'chalk';

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function ensureAgentrcRules(rootDir: string): Promise<string> {
  const rulesDir = join(rootDir, '.agentrc', 'rules');
  await mkdir(rulesDir, { recursive: true });
  return rulesDir;
}

// Import CLAUDE.md as an always-apply rule
async function importClaudeMd(rootDir: string, rulesDir: string): Promise<string[]> {
  const claudeMdPath = join(rootDir, 'CLAUDE.md');
  if (!(await pathExists(claudeMdPath))) return [];

  const content = await readFile(claudeMdPath, 'utf-8');
  const frontmatter = `---\nalwaysApply: true\npriority: normal\n---\n\n`;
  const outputPath = join(rulesDir, 'claude-imported.md');
  await writeFile(outputPath, `${frontmatter}${content}`, 'utf-8');

  return ['CLAUDE.md -> .agentrc/rules/claude-imported.md'];
}

// Import .cursor/rules/*.md, preserving existing frontmatter
async function importCursorRules(rootDir: string, rulesDir: string): Promise<string[]> {
  const cursorRulesDir = join(rootDir, '.cursor', 'rules');
  if (!(await isDirectory(cursorRulesDir))) return [];

  const entries = await readdir(cursorRulesDir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const imported: string[] = [];

  for (const file of mdFiles) {
    const sourcePath = join(cursorRulesDir, file);
    const content = await readFile(sourcePath, 'utf-8');

    // Cursor rules may already have frontmatter; preserve it as-is
    const outputName = `cursor-${basename(file)}`;
    const outputPath = join(rulesDir, outputName);
    await writeFile(outputPath, content, 'utf-8');

    imported.push(`.cursor/rules/${file} -> .agentrc/rules/${outputName}`);
  }

  return imported;
}

// Import .clinerules/*.md, translating "paths" frontmatter to "globs"
async function importClineRules(rootDir: string, rulesDir: string): Promise<string[]> {
  const clineRulesDir = join(rootDir, '.clinerules');
  if (!(await isDirectory(clineRulesDir))) return [];

  const entries = await readdir(clineRulesDir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const imported: string[] = [];

  for (const file of mdFiles) {
    const sourcePath = join(clineRulesDir, file);
    let content = await readFile(sourcePath, 'utf-8');

    // Translate "paths:" to "globs:" in frontmatter
    // This is a simple text replacement within the frontmatter block
    if (content.startsWith('---')) {
      const endIdx = content.indexOf('---', 3);
      if (endIdx !== -1) {
        const frontmatterBlock = content.slice(0, endIdx + 3);
        const body = content.slice(endIdx + 3);
        const translatedFrontmatter = frontmatterBlock.replace(/^paths:/m, 'globs:');
        content = `${translatedFrontmatter}${body}`;
      }
    }

    const outputName = `cline-${basename(file)}`;
    const outputPath = join(rulesDir, outputName);
    await writeFile(outputPath, content, 'utf-8');

    imported.push(`.clinerules/${file} -> .agentrc/rules/${outputName}`);
  }

  return imported;
}

export async function migrateCommand(): Promise<void> {
  const rootDir = process.cwd();

  // Warn if .agentrc/ already exists
  const agentrcDir = join(rootDir, '.agentrc');
  if (await pathExists(agentrcDir)) {
    console.log(
      chalk.yellow(
        'Warning: .agentrc/ already exists. Imported rules will be added to the existing directory.',
      ),
    );
  }

  // Ensure config.yaml exists (create minimal if not)
  const configPath = join(agentrcDir, 'config.yaml');
  if (!(await pathExists(configPath))) {
    await mkdir(agentrcDir, { recursive: true });
    await writeFile(configPath, 'version: "1"\ntargets: []\n', 'utf-8');
  }

  const rulesDir = await ensureAgentrcRules(rootDir);

  // Detect and import from each source
  const allImported: string[] = [];

  const claudeImports = await importClaudeMd(rootDir, rulesDir);
  allImported.push(...claudeImports);

  const cursorImports = await importCursorRules(rootDir, rulesDir);
  allImported.push(...cursorImports);

  const clineImports = await importClineRules(rootDir, rulesDir);
  allImported.push(...clineImports);

  if (allImported.length === 0) {
    console.log(
      chalk.yellow(
        'No existing config files found to import (checked: CLAUDE.md, .cursor/rules/, .clinerules/).',
      ),
    );
    return;
  }

  console.log(chalk.green(`\n✓ Imported ${allImported.length} files:\n`));
  for (const entry of allImported) {
    console.log(`  ${entry}`);
  }
  console.log(
    `\n  Review the imported files, then run ${chalk.blue('agentrc build')} to generate platform configs.`,
  );
}
