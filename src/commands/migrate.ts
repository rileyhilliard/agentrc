import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import chalk from 'chalk';
import { stringify as stringifyYaml } from 'yaml';
import { detectClaudeFormat, importClaude } from '../importers/claude.ts';
import type { ImportResult } from '../importers/types.ts';
import { isDirectory, pathExists } from '../utils.ts';

async function ensureAgentrcRules(rootDir: string): Promise<string> {
  const rulesDir = join(rootDir, '.agentrc', 'rules');
  await mkdir(rulesDir, { recursive: true });
  return rulesDir;
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

/** Write all imported items from an ImportResult to disk under .agentrc/. */
async function writeImportResults(result: ImportResult, outputDir: string): Promise<string[]> {
  const agentrcDir = join(outputDir, '.agentrc');
  const imported: string[] = [];

  // Rules
  if (result.rules.length > 0) {
    const rulesDir = join(agentrcDir, 'rules');
    await mkdir(rulesDir, { recursive: true });
    for (const rule of result.rules) {
      await writeFile(join(rulesDir, rule.filename), rule.content, 'utf-8');
      imported.push(`rules/${rule.filename}`);
    }
  }

  // Commands
  if (result.commands.length > 0) {
    const commandsDir = join(agentrcDir, 'commands');
    await mkdir(commandsDir, { recursive: true });
    for (const cmd of result.commands) {
      await writeFile(join(commandsDir, cmd.filename), cmd.content, 'utf-8');
      imported.push(`commands/${cmd.filename}`);
    }
  }

  // Agents
  if (result.agents.length > 0) {
    const agentsDir = join(agentrcDir, 'agents');
    await mkdir(agentsDir, { recursive: true });
    for (const agent of result.agents) {
      await writeFile(join(agentsDir, agent.filename), agent.content, 'utf-8');
      imported.push(`agents/${agent.filename}`);
    }
  }

  // Skills (each skill is a directory)
  if (result.skills.length > 0) {
    const skillsDir = join(agentrcDir, 'skills');
    for (const skill of result.skills) {
      for (const [relPath, content] of Object.entries(skill.files)) {
        const filePath = join(skillsDir, skill.dirname, relPath);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content, 'utf-8');
      }
      imported.push(`skills/${skill.dirname}/ (${Object.keys(skill.files).length} files)`);
    }
  }

  // Hook scripts
  if (result.scripts.length > 0) {
    const hooksDir = join(agentrcDir, 'hooks');
    await mkdir(hooksDir, { recursive: true });
    for (const script of result.scripts) {
      const scriptPath = join(hooksDir, script.filename);
      await writeFile(scriptPath, script.content, 'utf-8');
      await chmod(scriptPath, 0o755);
      imported.push(`hooks/${script.filename}`);
    }
  }

  // Config - merge hooks into existing config.yaml if present
  const configPath = join(agentrcDir, 'config.yaml');
  await mkdir(agentrcDir, { recursive: true });

  let configData: Record<string, unknown> = { version: '1', targets: [] };

  // Read existing config to preserve targets and other settings
  if (await pathExists(configPath)) {
    try {
      const existingRaw = await readFile(configPath, 'utf-8');
      const { parse: parseYaml } = await import('yaml');
      const existing = parseYaml(existingRaw) as Record<string, unknown>;
      if (existing && typeof existing === 'object') {
        configData = existing;
      }
    } catch {
      // Can't parse existing config, start fresh
    }
  }

  if (result.hooks.length > 0) {
    configData.hooks = result.hooks.map((h) => ({
      event: h.event,
      ...(h.match ? { match: h.match } : {}),
      run: h.run,
      description: h.description,
    }));
    imported.push('config.yaml (with hooks)');
  } else if (!(await pathExists(configPath))) {
    imported.push('config.yaml');
  }

  await writeFile(configPath, stringifyYaml(configData), 'utf-8');

  return imported;
}

/** Print a categorized summary of the import results. */
function printClaudeSummary(result: ImportResult, format: string): void {
  const label = format === 'claude-plugin' ? 'Claude Code plugin' : 'Claude Code';

  console.log(chalk.green(`\n✓ Imported from ${label}:\n`));

  if (result.rules.length > 0) console.log(`  Rules:    ${result.rules.length}`);
  if (result.commands.length > 0) console.log(`  Commands: ${result.commands.length}`);
  if (result.skills.length > 0) console.log(`  Skills:   ${result.skills.length}`);
  if (result.agents.length > 0) console.log(`  Agents:   ${result.agents.length}`);

  if (result.hooks.length > 0 || result.skipped.length > 0) {
    const skippedNote = result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : '';
    console.log(`  Hooks:    ${result.hooks.length}${skippedNote}`);
  }
  if (result.scripts.length > 0) console.log(`  Scripts:  ${result.scripts.length}`);

  const total =
    result.rules.length +
    result.commands.length +
    result.skills.length +
    result.agents.length +
    result.hooks.length +
    result.scripts.length;
  console.log(`\n  Total: ${total} items -> .agentrc/`);

  if (result.warnings.length > 0) {
    console.log('\n  Warnings:');
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  console.log(`\n  Run ${chalk.blue('agentrc build')} to generate platform configs.`);
}

export async function migrateCommand(sourcePath?: string): Promise<void> {
  const cwd = process.cwd();
  const resolvedSource = sourcePath ? resolve(sourcePath) : cwd;
  const outputDir = cwd;

  // Warn if .agentrc/ already exists
  const agentrcDir = join(outputDir, '.agentrc');
  if (await pathExists(agentrcDir)) {
    console.log(
      chalk.yellow(
        'Warning: .agentrc/ already exists. Imported files will be added to the existing directory.',
      ),
    );
  }

  // Try Claude detection first
  const claudeFormat = await detectClaudeFormat(resolvedSource);
  if (claudeFormat) {
    const result = await importClaude(resolvedSource, claudeFormat);
    const imported = await writeImportResults(result, outputDir);

    if (imported.length === 0) {
      console.log(chalk.yellow('Claude config detected but no importable items found.'));
      return;
    }

    printClaudeSummary(result, claudeFormat);

    // Check for other sources that were skipped
    const otherSources: string[] = [];
    if (await isDirectory(join(resolvedSource, '.cursor', 'rules'))) {
      otherSources.push('.cursor/rules/');
    }
    if (await isDirectory(join(resolvedSource, '.clinerules'))) {
      otherSources.push('.clinerules/');
    }
    if (otherSources.length > 0) {
      console.log(
        chalk.dim(
          `  Also found ${otherSources.join(', ')} — these were not imported (Claude config takes priority).`,
        ),
      );
    }
    return;
  }

  // Fall back to Cursor/Cline import
  // Ensure config.yaml exists (create minimal if not)
  const configPath = join(agentrcDir, 'config.yaml');
  if (!(await pathExists(configPath))) {
    await mkdir(agentrcDir, { recursive: true });
    await writeFile(configPath, 'version: "1"\ntargets: []\n', 'utf-8');
  }

  const rulesDir = await ensureAgentrcRules(outputDir);

  const allImported: string[] = [];

  const cursorImports = await importCursorRules(resolvedSource, rulesDir);
  allImported.push(...cursorImports);

  const clineImports = await importClineRules(resolvedSource, rulesDir);
  allImported.push(...clineImports);

  if (allImported.length === 0) {
    console.log(
      chalk.yellow(
        'No existing config files found to import (checked: .claude/, .cursor/rules/, .clinerules/).',
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
