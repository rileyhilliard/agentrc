import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCommand } from '../../src/commands/build.ts';
import { cleanCommand } from '../../src/commands/clean.ts';
import { FIXTURES } from '../helpers.ts';

async function createTempProject(fixtureName: 'full' | 'minimal'): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
  await cp(join(FIXTURES, fixtureName, '.agentrc'), join(tempDir, '.agentrc'), { recursive: true });
  return tempDir;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('cleanCommand', () => {
  test('clean removes generated files', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);

      // Build first to generate files + manifest
      await buildCommand({ targets: 'claude' });

      // Verify files were generated
      expect(await pathExists(join(tempDir, '.claude', 'rules'))).toBe(true);
      expect(await pathExists(join(tempDir, '.agentrc', '.manifest.json'))).toBe(true);

      // Clean
      await cleanCommand();

      // Generated files should be removed
      // The .claude/rules/ individual files should be gone
      expect(await pathExists(join(tempDir, '.claude', 'rules', 'typescript-strict.md'))).toBe(
        false,
      );
      // Manifest should also be removed
      expect(await pathExists(join(tempDir, '.agentrc', '.manifest.json'))).toBe(false);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('clean with no manifest is a no-op', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-cmd-test-'));
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      // Should not throw even though there's no manifest
      await cleanCommand();
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
