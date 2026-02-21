import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import type {
  DetectedSource,
  ImportedAgent,
  ImportedCommand,
  ImportedHook,
  ImportedRule,
  ImportedScript,
  ImportedSkill,
  ImportResult,
} from './types.ts';
import { isDirectory, pathExists, readDirRecursive } from './utils.ts';

/**
 * Reverse-map a Claude hook event/matcher pair to an agentrc hook event.
 * Returns null for events we don't support (e.g. SessionStart).
 */
function reverseMapHookEvent(
  claudeEvent: string,
  matcher: string,
): { event: ImportedHook['event']; description: string } | null {
  if (claudeEvent === 'PostToolUse') {
    if (matcher === 'Edit|Write|MultiEdit' || matcher.includes('Edit')) {
      return { event: 'post-edit', description: 'Run after file edits' };
    }
    if (matcher === 'Write') {
      return { event: 'post-create', description: 'Run after file creation' };
    }
  }
  if (claudeEvent === 'Notification') {
    if (matcher === 'Stop' || matcher === '') {
      return { event: 'pre-commit', description: 'Run on notification/completion' };
    }
  }
  return null;
}

/**
 * Detect whether a directory contains a Claude Code configuration.
 * Returns 'claude-standard' for .claude/ layout, 'claude-plugin' for
 * plugin layout, or null if neither is detected.
 */
export async function detectClaudeFormat(sourcePath: string): Promise<DetectedSource> {
  // Check for standard .claude/ layout
  const claudeDir = join(sourcePath, '.claude');
  if (await isDirectory(claudeDir)) {
    const standardSubdirs = ['rules', 'commands', 'skills', 'agents'];
    for (const sub of standardSubdirs) {
      if (await isDirectory(join(claudeDir, sub))) {
        return 'claude-standard';
      }
    }
    // settings.json also counts
    if (await pathExists(join(claudeDir, 'settings.json'))) {
      return 'claude-standard';
    }
  }

  // Check for .claude-plugin/ directory
  if (await isDirectory(join(sourcePath, '.claude-plugin'))) {
    return 'claude-plugin';
  }

  // Check for plugins/*/ with plugin-like content
  const pluginsDir = join(sourcePath, 'plugins');
  if (await isDirectory(pluginsDir)) {
    const pluginEntries = await readdir(pluginsDir);
    for (const entry of pluginEntries) {
      const pluginPath = join(pluginsDir, entry);
      if (!(await isDirectory(pluginPath))) continue;

      const pluginSubdirs = ['commands', 'skills', 'agents', 'hooks'];
      for (const sub of pluginSubdirs) {
        if (await isDirectory(join(pluginPath, sub))) {
          return 'claude-plugin';
        }
      }
    }
  }

  return null;
}

/**
 * Import a Claude Code project into the agentrc ImportResult format.
 * Dispatches to standard or plugin import based on detected format.
 */
export async function importClaude(
  sourcePath: string,
  format: DetectedSource,
): Promise<ImportResult> {
  if (format === 'claude-standard') {
    return importStandard(sourcePath);
  }
  if (format === 'claude-plugin') {
    return importPlugin(sourcePath);
  }
  return emptyResult();
}

function emptyResult(): ImportResult {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    hooks: [],
    scripts: [],
    warnings: [],
    skipped: [],
  };
}

// -- Standard .claude/ import --

async function importStandard(sourcePath: string): Promise<ImportResult> {
  const result = emptyResult();
  const claudeDir = join(sourcePath, '.claude');

  // Import root CLAUDE.md
  const claudeMdRules = await importClaudeMd(sourcePath);
  result.rules.push(...claudeMdRules);

  // Import .claude/rules/*.md
  const rules = await importRulesDir(join(claudeDir, 'rules'));
  result.rules.push(...rules);

  // Import .claude/commands/*.md
  const commands = await importCommandsDir(join(claudeDir, 'commands'));
  result.commands.push(...commands);

  // Import .claude/skills/*/
  const skills = await importSkillsDir(join(claudeDir, 'skills'));
  result.skills.push(...skills);

  // Import .claude/agents/*.md
  const agents = await importAgentsDir(join(claudeDir, 'agents'));
  result.agents.push(...agents);

  // Import hooks from .claude/settings.json
  const settingsPath = join(claudeDir, 'settings.json');
  if (await pathExists(settingsPath)) {
    const { hooks, warnings } = await importSettingsHooks(settingsPath);
    result.hooks.push(...hooks);
    result.warnings.push(...warnings);
  }

  return result;
}

// -- Plugin import --

async function importPlugin(sourcePath: string): Promise<ImportResult> {
  const result = emptyResult();

  // Import root CLAUDE.md if present
  const claudeMdRules = await importClaudeMd(sourcePath);
  result.rules.push(...claudeMdRules);

  // Find the plugin directory
  const pluginDir = await findPluginDir(sourcePath);
  if (!pluginDir) {
    result.warnings.push('Could not find plugin directory');
    return result;
  }

  // Import commands from plugin/commands/*.md
  const commands = await importCommandsDir(join(pluginDir, 'commands'));
  result.commands.push(...commands);

  // Import skills from plugin/skills/*/
  const skills = await importSkillsDir(join(pluginDir, 'skills'));
  result.skills.push(...skills);

  // Import agents from plugin/agents/*.md
  const agents = await importAgentsDir(join(pluginDir, 'agents'));
  result.agents.push(...agents);

  // Import hooks from plugin/hooks/hooks.json
  const hooksJsonPath = join(pluginDir, 'hooks', 'hooks.json');
  if (await pathExists(hooksJsonPath)) {
    const { hooks, warnings, scripts } = await importPluginHooks(hooksJsonPath, pluginDir);
    result.hooks.push(...hooks);
    result.warnings.push(...warnings);
    result.scripts.push(...scripts);
  }

  return result;
}

/** Locate the first plugin directory inside plugins/ or treat sourcePath as the plugin root. */
async function findPluginDir(sourcePath: string): Promise<string | null> {
  // Check plugins/*/ for subdirectories with plugin content
  const pluginsDir = join(sourcePath, 'plugins');
  if (await isDirectory(pluginsDir)) {
    const entries = await readdir(pluginsDir);
    for (const entry of entries.sort()) {
      const candidate = join(pluginsDir, entry);
      if (!(await isDirectory(candidate))) continue;

      const pluginSubdirs = ['commands', 'skills', 'agents', 'hooks'];
      for (const sub of pluginSubdirs) {
        if (await isDirectory(join(candidate, sub))) {
          return candidate;
        }
      }
    }
  }

  // Check if sourcePath itself has .claude-plugin/
  if (await isDirectory(join(sourcePath, '.claude-plugin'))) {
    return sourcePath;
  }

  return null;
}

// -- Shared sub-importers --

/** Import root CLAUDE.md as an always-apply rule. */
async function importClaudeMd(sourcePath: string): Promise<ImportedRule[]> {
  const claudeMdPath = join(sourcePath, 'CLAUDE.md');
  if (!(await pathExists(claudeMdPath))) return [];

  const content = await readFile(claudeMdPath, 'utf-8');
  const frontmatter = '---\nalwaysApply: true\npriority: normal\n---\n\n';

  return [
    {
      filename: 'project-instructions.md',
      content: `${frontmatter}${content}`,
    },
  ];
}

/** Import rules from a rules/ directory, converting paths: -> globs:. */
async function importRulesDir(rulesDir: string): Promise<ImportedRule[]> {
  if (!(await isDirectory(rulesDir))) return [];

  const entries = await readdir(rulesDir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const rules: ImportedRule[] = [];

  for (const file of mdFiles) {
    const filePath = join(rulesDir, file);
    const raw = await readFile(filePath, 'utf-8');

    const content = convertRuleFrontmatter(raw);
    rules.push({ filename: file, content });
  }

  return rules;
}

/**
 * Convert Claude rule frontmatter to agentrc format:
 * - Rename paths: -> globs:
 * - Add alwaysApply: true if no frontmatter present
 * - Leave other frontmatter as-is
 */
function convertRuleFrontmatter(raw: string): string {
  const parsed = matter(raw);

  // No frontmatter at all -> add alwaysApply: true
  if (Object.keys(parsed.data as Record<string, unknown>).length === 0 && !raw.startsWith('---')) {
    return `---\nalwaysApply: true\n---\n\n${raw}`;
  }

  // Has frontmatter with paths: -> rename to globs:
  const data = parsed.data as Record<string, unknown>;
  if ('paths' in data) {
    data.globs = data.paths;
    delete data.paths;
    return matter.stringify(parsed.content, data);
  }

  // Has other frontmatter (alwaysApply, description, etc.) -> keep as-is
  return raw;
}

/** Import commands from a commands/ directory, preserving all frontmatter. */
async function importCommandsDir(commandsDir: string): Promise<ImportedCommand[]> {
  if (!(await isDirectory(commandsDir))) return [];

  const entries = await readdir(commandsDir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const commands: ImportedCommand[] = [];

  for (const file of mdFiles) {
    const filePath = join(commandsDir, file);
    const content = await readFile(filePath, 'utf-8');
    commands.push({ filename: file, content });
  }

  return commands;
}

/** Import agents from an agents/ directory, preserving all frontmatter. */
async function importAgentsDir(agentsDir: string): Promise<ImportedAgent[]> {
  if (!(await isDirectory(agentsDir))) return [];

  const entries = await readdir(agentsDir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const agents: ImportedAgent[] = [];

  for (const file of mdFiles) {
    const filePath = join(agentsDir, file);
    const content = await readFile(filePath, 'utf-8');
    agents.push({ filename: file, content });
  }

  return agents;
}

/** Import skills from a skills/ directory, recursively reading all files. */
async function importSkillsDir(skillsDir: string): Promise<ImportedSkill[]> {
  if (!(await isDirectory(skillsDir))) return [];

  const entries = await readdir(skillsDir);
  const skills: ImportedSkill[] = [];

  for (const entry of entries.sort()) {
    const skillPath = join(skillsDir, entry);
    if (!(await isDirectory(skillPath))) continue;

    const files = await readDirRecursive(skillPath);
    if (Object.keys(files).length > 0) {
      skills.push({ dirname: entry, files });
    }
  }

  return skills;
}

/** Import hooks from .claude/settings.json. */
async function importSettingsHooks(
  settingsPath: string,
): Promise<{ hooks: ImportedHook[]; warnings: string[] }> {
  const hooks: ImportedHook[] = [];
  const warnings: string[] = [];

  let parsed: Record<string, unknown>;
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    warnings.push(`Failed to parse ${basename(settingsPath)}`);
    return { hooks, warnings };
  }

  const hooksConfig = parsed.hooks as Record<string, unknown> | undefined;
  if (!hooksConfig) return { hooks, warnings };

  for (const [eventName, eventEntries] of Object.entries(hooksConfig)) {
    if (!Array.isArray(eventEntries)) continue;

    for (const entry of eventEntries) {
      const entryObj = entry as { matcher?: string; hooks?: Array<{ command?: string }> };
      const matcher = entryObj.matcher ?? '';

      const mapped = reverseMapHookEvent(eventName, matcher);
      if (!mapped) {
        warnings.push(`Unsupported hook event: ${eventName} (matcher: "${matcher}")`);
        continue;
      }

      const hookCommands = entryObj.hooks ?? [];
      for (const hookCmd of hookCommands) {
        if (hookCmd.command) {
          hooks.push({
            event: mapped.event,
            run: hookCmd.command,
            description: mapped.description,
          });
        }
      }
    }
  }

  return { hooks, warnings };
}

/** Import hooks from a plugin hooks.json, also extracting referenced scripts. */
async function importPluginHooks(
  hooksJsonPath: string,
  pluginDir: string,
): Promise<{ hooks: ImportedHook[]; warnings: string[]; scripts: ImportedScript[] }> {
  const hooks: ImportedHook[] = [];
  const warnings: string[] = [];
  const scripts: ImportedScript[] = [];

  let parsed: Record<string, unknown>;
  try {
    const raw = await readFile(hooksJsonPath, 'utf-8');
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    warnings.push('Failed to parse hooks.json');
    return { hooks, warnings, scripts };
  }

  const hooksConfig = parsed.hooks as Record<string, unknown> | undefined;
  if (!hooksConfig) return { hooks, warnings, scripts };

  const hooksDir = join(pluginDir, 'hooks');
  const importedScripts = new Set<string>();

  for (const [eventName, eventEntries] of Object.entries(hooksConfig)) {
    if (!Array.isArray(eventEntries)) continue;

    for (const entry of eventEntries) {
      const entryObj = entry as { matcher?: string; hooks?: Array<{ command?: string }> };
      const matcher = entryObj.matcher ?? '';

      const mapped = reverseMapHookEvent(eventName, matcher);
      if (!mapped) {
        warnings.push(`Unsupported hook event: ${eventName} (matcher: "${matcher}")`);
        continue;
      }

      const hookCommands = entryObj.hooks ?? [];
      for (const hookCmd of hookCommands) {
        if (!hookCmd.command) continue;

        hooks.push({
          event: mapped.event,
          run: hookCmd.command,
          description: mapped.description,
        });

        // Extract script references and import them
        const scriptMatches = hookCmd.command.match(/[\w-]+\.sh/g);
        if (scriptMatches) {
          for (const scriptName of scriptMatches) {
            if (importedScripts.has(scriptName)) continue;

            const scriptPath = join(hooksDir, scriptName);
            if (await pathExists(scriptPath)) {
              const content = await readFile(scriptPath, 'utf-8');
              scripts.push({ filename: scriptName, content });
              importedScripts.add(scriptName);
            } else {
              warnings.push(`Referenced script "${scriptName}" not found at ${scriptPath}`);
            }
          }
        }
      }
    }
  }

  return { hooks, warnings, scripts };
}
