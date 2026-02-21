import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectCommand } from '../../src/commands/inspect.ts';
import { FIXTURES } from '../helpers.ts';

async function createTempProject(fixtureName: 'full' | 'minimal'): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
  await cp(join(FIXTURES, fixtureName, '.agentrc'), join(tempDir, '.agentrc'), { recursive: true });
  return tempDir;
}

describe('inspectCommand', () => {
  test('inspect claude shows native features', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    const logs: string[] = [];
    const originalLog = console.log;
    try {
      process.chdir(tempDir);
      console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
      await inspectCommand('claude');

      const output = logs.join('\n');
      expect(output).toContain('instructions');
      expect(output).toContain('hooks');
      expect(output).toContain('commands');
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('inspect unknown platform throws', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await expect(inspectCommand('nonexistent')).rejects.toThrow('Unknown adapter');
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
