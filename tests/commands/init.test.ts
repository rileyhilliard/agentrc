import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initCommand } from '../../src/commands/init.ts';

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('initCommand', () => {
  test('creates .agentrc/ structure', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await initCommand({});

      expect(await pathExists(join(tempDir, '.agentrc', 'config.yaml'))).toBe(true);
      expect(await pathExists(join(tempDir, '.agentrc', 'rules', 'general.md'))).toBe(true);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('config has default targets', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await initCommand({});

      const config = await readFile(join(tempDir, '.agentrc', 'config.yaml'), 'utf-8');
      expect(config).toContain('claude');
      expect(config).toContain('cursor');
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('rule has frontmatter', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await initCommand({});

      const rule = await readFile(join(tempDir, '.agentrc', 'rules', 'general.md'), 'utf-8');
      expect(rule).not.toContain('alwaysApply');
      expect(rule).toContain('priority: normal');
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('skips if .agentrc/ already exists', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
    const originalCwd = process.cwd();
    const logs: string[] = [];
    const originalLog = console.log;
    try {
      process.chdir(tempDir);

      // Pre-create the .agentrc directory
      await mkdir(join(tempDir, '.agentrc'), { recursive: true });

      console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
      await initCommand({});

      const output = logs.join('\n');
      expect(output).toContain('already exists');

      // config.yaml should NOT have been created since we skipped
      expect(await pathExists(join(tempDir, '.agentrc', 'config.yaml'))).toBe(false);
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
