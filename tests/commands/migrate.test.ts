import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { migrateCommand } from '../../src/commands/migrate.ts';

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

let tempDir: string;
let originalCwd: string;
let logs: string[];
let originalLog: typeof console.log;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agentrc-migrate-'));
  originalCwd = process.cwd();
  logs = [];
  originalLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
});

afterEach(async () => {
  console.log = originalLog;
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe('Claude standard import', () => {
  test('imports .claude/ standard layout into .agentrc/', async () => {
    process.chdir(tempDir);

    // Set up a standard Claude project structure
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await mkdir(join(tempDir, '.claude', 'commands'), { recursive: true });
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Project Instructions\n\nBe helpful.\n', 'utf-8');
    await writeFile(
      join(tempDir, '.claude', 'rules', 'style.md'),
      '---\nalwaysApply: true\n---\n\nUse consistent style.\n',
      'utf-8',
    );
    await writeFile(
      join(tempDir, '.claude', 'commands', 'test.md'),
      '---\ndescription: "Run tests"\n---\n\nRun `bun test`.\n',
      'utf-8',
    );

    await migrateCommand();

    // Verify rules were written
    const rulesDir = join(tempDir, '.agentrc', 'rules');
    expect(await pathExists(join(rulesDir, 'project-instructions.md'))).toBe(true);
    expect(await pathExists(join(rulesDir, 'style.md'))).toBe(true);

    // Verify commands were written
    const commandsDir = join(tempDir, '.agentrc', 'commands');
    expect(await pathExists(join(commandsDir, 'test.md'))).toBe(true);

    const cmdContent = await readFile(join(commandsDir, 'test.md'), 'utf-8');
    expect(cmdContent).toContain('Run tests');

    // Verify config.yaml was created
    expect(await pathExists(join(tempDir, '.agentrc', 'config.yaml'))).toBe(true);

    // Check summary output
    const output = logs.join('\n');
    expect(output).toContain('Imported from Claude Code');
    expect(output).toContain('Rules:');
    expect(output).toContain('Commands:');
  });

  test('imports agents and skills from standard layout', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.claude', 'agents'), { recursive: true });
    const skillDir = join(tempDir, '.claude', 'skills', 'debugging');
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      join(tempDir, '.claude', 'agents', 'reviewer.md'),
      '---\nname: "Code Reviewer"\n---\n\nReview code.\n',
      'utf-8',
    );
    await writeFile(join(skillDir, 'SKILL.md'), '# Debugging\n\nDebug stuff.\n', 'utf-8');

    await migrateCommand();

    // Agents
    expect(await pathExists(join(tempDir, '.agentrc', 'agents', 'reviewer.md'))).toBe(true);

    // Skills
    expect(await pathExists(join(tempDir, '.agentrc', 'skills', 'debugging', 'SKILL.md'))).toBe(
      true,
    );

    const skillContent = await readFile(
      join(tempDir, '.agentrc', 'skills', 'debugging', 'SKILL.md'),
      'utf-8',
    );
    expect(skillContent).toContain('Debugging');
  });

  test('imports hooks from settings.json and writes config.yaml', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const settings = {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [{ type: 'command', command: 'bun run lint:fix' }],
          },
        ],
      },
    };
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8',
    );

    await migrateCommand();

    const configPath = join(tempDir, '.agentrc', 'config.yaml');
    expect(await pathExists(configPath)).toBe(true);

    const configContent = await readFile(configPath, 'utf-8');
    const config = parseYaml(configContent) as Record<string, unknown>;
    expect(config.version).toBe('1');
    expect(config.hooks).toBeDefined();

    const hooks = config.hooks as Array<Record<string, string>>;
    expect(hooks.length).toBe(1);
    expect(hooks[0].event).toBe('post-edit');
    expect(hooks[0].run).toBe('bun run lint:fix');
  });
});

describe('Claude plugin import', () => {
  test('imports plugin structure with plugins/*/', async () => {
    process.chdir(tempDir);

    const pluginDir = join(tempDir, 'plugins', 'my-plugin');
    await mkdir(join(pluginDir, 'commands'), { recursive: true });
    await mkdir(join(pluginDir, 'agents'), { recursive: true });

    await writeFile(
      join(pluginDir, 'commands', 'deploy.md'),
      '---\ndescription: "Deploy the app"\n---\n\nRun deploy.\n',
      'utf-8',
    );
    await writeFile(
      join(pluginDir, 'agents', 'ops.md'),
      '---\nname: "Ops Agent"\n---\n\nHandle ops.\n',
      'utf-8',
    );

    await migrateCommand();

    // Verify commands and agents were written
    expect(await pathExists(join(tempDir, '.agentrc', 'commands', 'deploy.md'))).toBe(true);
    expect(await pathExists(join(tempDir, '.agentrc', 'agents', 'ops.md'))).toBe(true);

    // Check summary mentions plugin
    const output = logs.join('\n');
    expect(output).toContain('Imported from Claude Code plugin');
  });

  test('imports hook scripts and makes them executable', async () => {
    process.chdir(tempDir);

    const pluginDir = join(tempDir, 'plugins', 'my-plugin');
    await mkdir(join(pluginDir, 'commands'), { recursive: true });
    await mkdir(join(pluginDir, 'hooks'), { recursive: true });

    const pluginRoot = '$' + '{CLAUDE_PLUGIN_ROOT}';
    const hooksJson = {
      hooks: {
        Notification: [
          {
            matcher: '',
            hooks: [
              {
                type: 'command',
                command: `bash ${pluginRoot}/hooks/notify.sh`,
              },
            ],
          },
        ],
      },
    };
    await writeFile(
      join(pluginDir, 'hooks', 'hooks.json'),
      JSON.stringify(hooksJson, null, 2),
      'utf-8',
    );
    await writeFile(
      join(pluginDir, 'hooks', 'notify.sh'),
      '#!/bin/bash\necho "notifying"',
      'utf-8',
    );

    await migrateCommand();

    // Hook script should be written and executable
    const scriptPath = join(tempDir, '.agentrc', 'hooks', 'notify.sh');
    expect(await pathExists(scriptPath)).toBe(true);

    const scriptStat = await stat(scriptPath);
    // Check executable bit (owner execute = 0o100)
    expect(scriptStat.mode & 0o100).toBeTruthy();

    // config.yaml should contain hooks
    const configPath = join(tempDir, '.agentrc', 'config.yaml');
    const configContent = await readFile(configPath, 'utf-8');
    const config = parseYaml(configContent) as Record<string, unknown>;
    const hooks = config.hooks as Array<Record<string, string>>;
    expect(hooks.length).toBe(1);
    expect(hooks[0].event).toBe('pre-commit');
  });
});

describe('Cursor fallback', () => {
  test('falls back to Cursor import when no Claude config detected', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.cursor', 'rules', 'my-rule.md'),
      '---\ndescription: "A cursor rule"\n---\n\nDo cursor things.\n',
      'utf-8',
    );

    await migrateCommand();

    const importedPath = join(tempDir, '.agentrc', 'rules', 'cursor-my-rule.md');
    expect(await pathExists(importedPath)).toBe(true);

    const content = await readFile(importedPath, 'utf-8');
    expect(content).toContain('Do cursor things.');

    // Should use the legacy summary format
    const output = logs.join('\n');
    expect(output).toContain('Imported');
    expect(output).toContain('files');
  });
});

describe('Cline fallback', () => {
  test('falls back to Cline import with paths->globs translation', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.clinerules'), { recursive: true });
    await writeFile(
      join(tempDir, '.clinerules', 'test.md'),
      '---\npaths:\n  - src/**/*.ts\n---\n\nCline test rule.\n',
      'utf-8',
    );

    await migrateCommand();

    const importedPath = join(tempDir, '.agentrc', 'rules', 'cline-test.md');
    expect(await pathExists(importedPath)).toBe(true);

    const content = await readFile(importedPath, 'utf-8');
    expect(content).toContain('globs:');
    expect(content).not.toContain('paths:');
    expect(content).toContain('Cline test rule.');
  });
});

describe('sourcePath argument', () => {
  test('imports from a remote source path into cwd', async () => {
    // Set up source in one dir, cwd in another
    const sourceDir = await mkdtemp(join(tmpdir(), 'agentrc-migrate-source-'));

    try {
      process.chdir(tempDir);

      await mkdir(join(sourceDir, '.claude', 'rules'), { recursive: true });
      await writeFile(
        join(sourceDir, '.claude', 'rules', 'remote-rule.md'),
        '---\nalwaysApply: true\n---\n\nRemote rule content.\n',
        'utf-8',
      );

      await migrateCommand(sourceDir);

      // Files should be written in cwd (tempDir), not sourceDir
      expect(await pathExists(join(tempDir, '.agentrc', 'rules', 'remote-rule.md'))).toBe(true);
      expect(await pathExists(join(sourceDir, '.agentrc', 'rules', 'remote-rule.md'))).toBe(false);
    } finally {
      await rm(sourceDir, { recursive: true, force: true });
    }
  });

  test('defaults to cwd when no sourcePath provided', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'rules', 'local.md'), 'Local rule.\n', 'utf-8');

    await migrateCommand();

    expect(await pathExists(join(tempDir, '.agentrc', 'rules', 'local.md'))).toBe(true);
  });
});

describe('summary output', () => {
  test('prints categorized summary for Claude import', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await mkdir(join(tempDir, '.claude', 'commands'), { recursive: true });
    await mkdir(join(tempDir, '.claude', 'agents'), { recursive: true });

    await writeFile(join(tempDir, '.claude', 'rules', 'r1.md'), 'Rule one.\n', 'utf-8');
    await writeFile(
      join(tempDir, '.claude', 'commands', 'c1.md'),
      '---\ndescription: "cmd"\n---\n\nDo it.\n',
      'utf-8',
    );
    await writeFile(
      join(tempDir, '.claude', 'agents', 'a1.md'),
      '---\nname: "Agent"\n---\n\nDo agent things.\n',
      'utf-8',
    );

    await migrateCommand();

    const output = logs.join('\n');
    expect(output).toContain('Rules:');
    expect(output).toContain('Commands:');
    expect(output).toContain('Agents:');
    expect(output).toContain('Total:');
    expect(output).toContain('items -> .agentrc/');
    expect(output).toContain('agentrc build');
  });

  test('prints warnings for unsupported hooks', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const settings = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup',
            hooks: [{ type: 'command', command: 'echo "startup"' }],
          },
        ],
      },
    };
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8',
    );

    await migrateCommand();

    const output = logs.join('\n');
    expect(output).toContain('Warnings:');
    expect(output).toContain('SessionStart');
  });
});

describe('edge cases', () => {
  test('no sources found does not throw', async () => {
    process.chdir(tempDir);

    // Should not throw with an empty directory
    await migrateCommand();

    const output = logs.join('\n');
    expect(output).toContain('No existing config files found');
  });

  test('warns when .agentrc/ already exists', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.agentrc'), { recursive: true });
    await mkdir(join(tempDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(tempDir, '.cursor', 'rules', 'existing.md'), 'Existing rule.\n', 'utf-8');

    await migrateCommand();

    const output = logs.join('\n');
    expect(output).toContain('Warning');
    expect(output).toContain('already exists');
  });

  test('creates minimal config.yaml when no hooks present', async () => {
    process.chdir(tempDir);

    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'rules', 'simple.md'), 'Simple rule.\n', 'utf-8');

    await migrateCommand();

    const configPath = join(tempDir, '.agentrc', 'config.yaml');
    expect(await pathExists(configPath)).toBe(true);

    const content = await readFile(configPath, 'utf-8');
    expect(content).toContain('version');
    expect(content).toContain('targets');
  });
});
