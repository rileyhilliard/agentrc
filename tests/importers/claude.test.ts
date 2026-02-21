import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectClaudeFormat, importClaude } from '../../src/importers/claude.ts';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agentrc-importer-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// -- detectClaudeFormat --

describe('detectClaudeFormat', () => {
  test('detects claude-standard with .claude/rules/', async () => {
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-standard');
  });

  test('detects claude-standard with .claude/commands/', async () => {
    await mkdir(join(tempDir, '.claude', 'commands'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-standard');
  });

  test('detects claude-standard with .claude/skills/', async () => {
    await mkdir(join(tempDir, '.claude', 'skills'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-standard');
  });

  test('detects claude-standard with .claude/agents/', async () => {
    await mkdir(join(tempDir, '.claude', 'agents'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-standard');
  });

  test('detects claude-standard with .claude/settings.json', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'settings.json'), '{}', 'utf-8');

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-standard');
  });

  test('detects claude-plugin with .claude-plugin/ dir', async () => {
    await mkdir(join(tempDir, '.claude-plugin'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-plugin');
  });

  test('detects claude-plugin with plugins/*/ containing commands/', async () => {
    await mkdir(join(tempDir, 'plugins', 'my-plugin', 'commands'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-plugin');
  });

  test('detects claude-plugin with plugins/*/ containing skills/', async () => {
    await mkdir(join(tempDir, 'plugins', 'my-plugin', 'skills'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBe('claude-plugin');
  });

  test('returns null for non-claude directory', async () => {
    // Just an empty temp dir
    const format = await detectClaudeFormat(tempDir);
    expect(format).toBeNull();
  });

  test('returns null for .claude/ with no recognized subdirs', async () => {
    await mkdir(join(tempDir, '.claude', 'random-stuff'), { recursive: true });

    const format = await detectClaudeFormat(tempDir);
    expect(format).toBeNull();
  });
});

// -- importClaude: standard format --

describe('importClaude (standard)', () => {
  test('imports rules with paths: -> globs: conversion', async () => {
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', 'react.md'),
      '---\npaths:\n  - "src/components/**/*.tsx"\n  - "src/pages/**/*.tsx"\n---\n\nUse functional components.\n',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.rules.length).toBeGreaterThanOrEqual(1);
    const reactRule = result.rules.find((r) => r.filename === 'react.md');
    expect(reactRule).toBeDefined();
    expect(reactRule?.content).toContain('globs:');
    expect(reactRule?.content).not.toContain('paths:');
    expect(reactRule?.content).toContain('src/components/**/*.tsx');
    expect(reactRule?.content).toContain('Use functional components.');
  });

  test('imports rules without frontmatter and adds alwaysApply', async () => {
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', 'general.md'),
      'Be helpful and concise.\n',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-standard');

    const generalRule = result.rules.find((r) => r.filename === 'general.md');
    expect(generalRule).toBeDefined();
    expect(generalRule?.content).toContain('---\nalwaysApply: true\n---');
    expect(generalRule?.content).toContain('Be helpful and concise.');
  });

  test('imports rules with existing frontmatter as-is', async () => {
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    const original =
      '---\nalwaysApply: true\ndescription: "A test rule"\n---\n\nKeep things tidy.\n';
    await writeFile(join(tempDir, '.claude', 'rules', 'tidy.md'), original, 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    const tidyRule = result.rules.find((r) => r.filename === 'tidy.md');
    expect(tidyRule).toBeDefined();
    expect(tidyRule?.content).toBe(original);
  });

  test('imports root CLAUDE.md as project-instructions.md', async () => {
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      '# Project Instructions\n\nDo the thing.\n',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-standard');

    const projRule = result.rules.find((r) => r.filename === 'project-instructions.md');
    expect(projRule).toBeDefined();
    expect(projRule?.content).toContain('alwaysApply: true');
    expect(projRule?.content).toContain('priority: normal');
    expect(projRule?.content).toContain('# Project Instructions');
    expect(projRule?.content).toContain('Do the thing.');
  });

  test('imports commands preserving all frontmatter', async () => {
    await mkdir(join(tempDir, '.claude', 'commands'), { recursive: true });
    const commandContent =
      '---\ndescription: "Run the test suite"\nargument-hint: "--watch"\nallowed-tools: ["Bash"]\n---\n\nRun `bun test` with the given arguments.\n';
    await writeFile(join(tempDir, '.claude', 'commands', 'test.md'), commandContent, 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].filename).toBe('test.md');
    // Content should be preserved unchanged
    expect(result.commands[0].content).toBe(commandContent);
  });

  test('imports agents preserving all frontmatter', async () => {
    await mkdir(join(tempDir, '.claude', 'agents'), { recursive: true });
    const agentContent =
      '---\nname: "Code Reviewer"\ndescription: "Reviews code for quality"\nmodel: sonnet\ntools:\n  - Read\n  - Bash\nskills:\n  - code-review\ncolor: blue\n---\n\nYou are a code review specialist.\n';
    await writeFile(join(tempDir, '.claude', 'agents', 'reviewer.md'), agentContent, 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].filename).toBe('reviewer.md');
    expect(result.agents[0].content).toBe(agentContent);
  });

  test('imports skills with subdirectories', async () => {
    const skillDir = join(tempDir, '.claude', 'skills', 'debugging');
    const refsDir = join(skillDir, 'references');
    await mkdir(refsDir, { recursive: true });

    await writeFile(join(skillDir, 'SKILL.md'), '# Debugging Skill\n\nDebug things.\n', 'utf-8');
    await writeFile(join(refsDir, 'tips.md'), '# Tips\n\nUse breakpoints.\n', 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].dirname).toBe('debugging');
    expect(result.skills[0].files['SKILL.md']).toContain('Debugging Skill');
    expect(result.skills[0].files['references/tips.md']).toContain('Use breakpoints');
  });

  test('skills skip binary files', async () => {
    const skillDir = join(tempDir, '.claude', 'skills', 'visual');
    await mkdir(skillDir, { recursive: true });

    await writeFile(join(skillDir, 'SKILL.md'), '# Visual\n', 'utf-8');
    await writeFile(join(skillDir, 'icon.png'), 'fake-binary', 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].files['SKILL.md']).toBeDefined();
    expect(result.skills[0].files['icon.png']).toBeUndefined();
  });

  test('reverse-maps hooks from settings.json', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const settings = {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [{ type: 'command', command: 'echo "post-edit"' }],
          },
          {
            matcher: 'Write',
            hooks: [{ type: 'command', command: 'echo "post-create"' }],
          },
        ],
        Notification: [
          {
            matcher: 'Stop',
            hooks: [{ type: 'command', command: 'echo "pre-commit"' }],
          },
        ],
      },
    };
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.hooks).toHaveLength(3);

    const postEdit = result.hooks.find((h) => h.event === 'post-edit');
    expect(postEdit).toBeDefined();
    expect(postEdit?.run).toBe('echo "post-edit"');

    const postCreate = result.hooks.find((h) => h.event === 'post-create');
    expect(postCreate).toBeDefined();
    expect(postCreate?.run).toBe('echo "post-create"');

    const preCommit = result.hooks.find((h) => h.event === 'pre-commit');
    expect(preCommit).toBeDefined();
    expect(preCommit?.run).toBe('echo "pre-commit"');
  });

  test('warns about unsupported hook events', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const settings = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup|resume',
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

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.hooks).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('SessionStart');
  });

  test('Notification with empty matcher maps to pre-commit', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const settings = {
      hooks: {
        Notification: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: 'bash notify.sh' }],
          },
        ],
      },
    };
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.hooks).toHaveLength(1);
    expect(result.hooks[0].event).toBe('pre-commit');
  });

  test('returns empty result for non-existent subdirs', async () => {
    // Only have .claude/ with nothing in it
    await mkdir(join(tempDir, '.claude'), { recursive: true });

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.rules).toHaveLength(0);
    expect(result.commands).toHaveLength(0);
    expect(result.agents).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.hooks).toHaveLength(0);
  });
});

// -- importClaude: plugin format --

describe('importClaude (plugin)', () => {
  test('imports plugin format with plugins/*/ structure', async () => {
    const pluginDir = join(tempDir, 'plugins', 'my-plugin');
    await mkdir(join(pluginDir, 'commands'), { recursive: true });
    await mkdir(join(pluginDir, 'agents'), { recursive: true });

    await writeFile(
      join(pluginDir, 'commands', 'deploy.md'),
      '---\ndescription: "Deploy the app"\n---\n\nRun the deploy script.\n',
      'utf-8',
    );
    await writeFile(
      join(pluginDir, 'agents', 'ops.md'),
      '---\nname: "Ops Agent"\ndescription: "Handles ops"\n---\n\nYou handle operations.\n',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-plugin');

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].filename).toBe('deploy.md');
    expect(result.commands[0].content).toContain('Deploy the app');

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].filename).toBe('ops.md');
  });

  test('imports plugin skills', async () => {
    const pluginDir = join(tempDir, 'plugins', 'my-plugin');
    const skillDir = join(pluginDir, 'skills', 'testing');
    await mkdir(skillDir, { recursive: true });

    await writeFile(join(skillDir, 'SKILL.md'), '# Testing Skill\n', 'utf-8');

    const result = await importClaude(tempDir, 'claude-plugin');

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].dirname).toBe('testing');
    expect(result.skills[0].files['SKILL.md']).toContain('Testing Skill');
  });

  test('warns about unsupported plugin hook events (SessionStart)', async () => {
    const pluginDir = join(tempDir, 'plugins', 'my-plugin');
    await mkdir(join(pluginDir, 'commands'), { recursive: true });
    await mkdir(join(pluginDir, 'hooks'), { recursive: true });

    // Construct the shell variable reference via concatenation to avoid biome's template-string lint
    const pluginRoot = '$' + '{CLAUDE_PLUGIN_ROOT}';
    const hooksJson = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup|resume|clear|compact',
            hooks: [
              {
                type: 'command',
                command: `bash ${pluginRoot}/hooks/session-start.sh`,
              },
            ],
          },
        ],
        Notification: [
          {
            matcher: '',
            hooks: [
              {
                type: 'command',
                command: `bash ${pluginRoot}/hooks/notify.sh ${pluginRoot}`,
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
      join(pluginDir, 'hooks', 'session-start.sh'),
      '#!/bin/bash\necho "starting"',
      'utf-8',
    );
    await writeFile(
      join(pluginDir, 'hooks', 'notify.sh'),
      '#!/bin/bash\necho "notifying"',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-plugin');

    // SessionStart should be warned about
    expect(result.warnings.some((w) => w.includes('SessionStart'))).toBe(true);

    // Notification should be imported as pre-commit
    expect(result.hooks).toHaveLength(1);
    expect(result.hooks[0].event).toBe('pre-commit');
    expect(result.hooks[0].run).toContain('notify.sh');
  });

  test('copies hook scripts referenced in commands', async () => {
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
                command: `bash ${pluginRoot}/hooks/notify.sh ${pluginRoot}`,
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
      '#!/bin/bash\necho "notification sent"',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-plugin');

    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0].filename).toBe('notify.sh');
    expect(result.scripts[0].content).toContain('notification sent');
  });

  test('imports root CLAUDE.md for plugin format', async () => {
    const pluginDir = join(tempDir, 'plugins', 'my-plugin');
    await mkdir(join(pluginDir, 'commands'), { recursive: true });
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      '# Plugin Project\n\nPlugin instructions.\n',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-plugin');

    const projRule = result.rules.find((r) => r.filename === 'project-instructions.md');
    expect(projRule).toBeDefined();
    expect(projRule?.content).toContain('Plugin instructions.');
  });

  test('handles .claude-plugin/ as plugin root', async () => {
    await mkdir(join(tempDir, '.claude-plugin'), { recursive: true });
    await mkdir(join(tempDir, 'commands'), { recursive: true });
    await writeFile(
      join(tempDir, 'commands', 'hello.md'),
      '---\ndescription: "Say hello"\n---\n\nSay hello to the world.\n',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-plugin');

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].filename).toBe('hello.md');
  });

  test('returns warnings when no plugin directory is found', async () => {
    // No plugins/ dir, no .claude-plugin/ dir
    const result = await importClaude(tempDir, 'claude-plugin');

    expect(result.warnings).toContain('Could not find plugin directory');
  });
});

// -- importClaude: null format --

describe('importClaude (null format)', () => {
  test('returns empty result for null format', async () => {
    const result = await importClaude(tempDir, null);

    expect(result.rules).toHaveLength(0);
    expect(result.commands).toHaveLength(0);
    expect(result.agents).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.hooks).toHaveLength(0);
    expect(result.scripts).toHaveLength(0);
  });
});

// -- Edge cases --

describe('edge cases', () => {
  test('handles malformed settings.json gracefully', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'settings.json'), 'not valid json!!!', 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.warnings.some((w) => w.includes('Failed to parse'))).toBe(true);
    expect(result.hooks).toHaveLength(0);
  });

  test('multiple rules are all imported', async () => {
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'rules', 'a-rule.md'), 'Rule A content.\n', 'utf-8');
    await writeFile(join(tempDir, '.claude', 'rules', 'b-rule.md'), 'Rule B content.\n', 'utf-8');
    await writeFile(
      join(tempDir, '.claude', 'rules', 'c-rule.md'),
      '---\npaths:\n  - "**/*.ts"\n---\n\nRule C content.\n',
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-standard');

    // Rules from the rules/ dir (not counting any CLAUDE.md)
    const rulesFromDir = result.rules.filter((r) => r.filename !== 'project-instructions.md');
    expect(rulesFromDir).toHaveLength(3);
    expect(rulesFromDir[0].filename).toBe('a-rule.md');
    expect(rulesFromDir[1].filename).toBe('b-rule.md');
    expect(rulesFromDir[2].filename).toBe('c-rule.md');
  });

  test('multiple skills each get their own entry', async () => {
    const skills1 = join(tempDir, '.claude', 'skills', 'alpha');
    const skills2 = join(tempDir, '.claude', 'skills', 'beta');
    await mkdir(skills1, { recursive: true });
    await mkdir(skills2, { recursive: true });

    await writeFile(join(skills1, 'SKILL.md'), '# Alpha\n', 'utf-8');
    await writeFile(join(skills2, 'SKILL.md'), '# Beta\n', 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.skills).toHaveLength(2);
    expect(result.skills[0].dirname).toBe('alpha');
    expect(result.skills[1].dirname).toBe('beta');
  });

  test('non-.md files in rules/ dir are ignored', async () => {
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'rules', 'valid.md'), 'Valid rule.\n', 'utf-8');
    await writeFile(join(tempDir, '.claude', 'rules', 'not-md.txt'), 'Not a rule.\n', 'utf-8');

    const result = await importClaude(tempDir, 'claude-standard');

    const rulesFromDir = result.rules.filter((r) => r.filename !== 'project-instructions.md');
    expect(rulesFromDir).toHaveLength(1);
    expect(rulesFromDir[0].filename).toBe('valid.md');
  });

  test('PostToolUse with Edit in matcher maps to post-edit', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const settings = {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit',
            hooks: [{ type: 'command', command: 'echo "edit only"' }],
          },
        ],
      },
    };
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8',
    );

    const result = await importClaude(tempDir, 'claude-standard');

    expect(result.hooks).toHaveLength(1);
    expect(result.hooks[0].event).toBe('post-edit');
  });
});
