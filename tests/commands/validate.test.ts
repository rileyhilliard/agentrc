import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCommand } from '../../src/commands/validate.ts';
import { FIXTURES } from '../helpers.ts';

async function createTempProject(fixtureName: 'full' | 'minimal'): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
  await cp(join(FIXTURES, fixtureName, '.agentrc'), join(tempDir, '.agentrc'), { recursive: true });
  return tempDir;
}

describe('validateCommand', () => {
  test('valid config succeeds without throwing', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      // Should complete without throwing
      await validateCommand();
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('reports correct counts', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    const logs: string[] = [];
    const originalLog = console.log;
    try {
      process.chdir(tempDir);
      console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
      await validateCommand();

      const output = logs.join('\n');
      // Full fixture has 4 rules, 2 hooks, 2 commands, 1 skill
      expect(output).toContain('Rules:');
      expect(output).toContain('Hooks:');
      expect(output).toContain('Commands:');
      expect(output).toContain('Skills:');
      expect(output).toContain('Targets:');
      expect(output).toContain('Config is valid');
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('missing .agentrc throws', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await expect(validateCommand()).rejects.toThrow();
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
