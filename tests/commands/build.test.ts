import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCommand } from '../../src/commands/build.ts';
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

describe('buildCommand', () => {
  test('full build creates output files for all targets', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await buildCommand({});

      // Claude adapter outputs
      expect(await pathExists(join(tempDir, '.claude', 'rules'))).toBe(true);
      const claudeRuleContent = await readFile(
        join(tempDir, '.claude', 'rules', 'typescript-strict.md'),
        'utf-8',
      );
      expect(claudeRuleContent).toContain('strict TypeScript');

      // Cursor adapter outputs
      expect(await pathExists(join(tempDir, '.cursor', 'rules'))).toBe(true);

      // Copilot adapter outputs
      expect(await pathExists(join(tempDir, '.github', 'copilot-instructions.md'))).toBe(true);

      // Windsurf adapter outputs
      expect(await pathExists(join(tempDir, '.windsurf', 'rules'))).toBe(true);

      // Gemini adapter outputs
      expect(await pathExists(join(tempDir, 'GEMINI.md'))).toBe(true);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('build with --targets flag limits output to specified target', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await buildCommand({ targets: 'claude' });

      // Claude output should exist
      expect(await pathExists(join(tempDir, '.claude', 'rules'))).toBe(true);

      // Other adapter outputs should NOT exist
      expect(await pathExists(join(tempDir, '.cursor', 'rules'))).toBe(false);
      expect(await pathExists(join(tempDir, '.windsurf', 'rules'))).toBe(false);
      expect(await pathExists(join(tempDir, 'GEMINI.md'))).toBe(false);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('dry run does not write files', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await buildCommand({ dryRun: true });

      // No adapter outputs should be written
      expect(await pathExists(join(tempDir, '.claude', 'rules'))).toBe(false);
      expect(await pathExists(join(tempDir, '.cursor', 'rules'))).toBe(false);
      expect(await pathExists(join(tempDir, 'GEMINI.md'))).toBe(false);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('build creates .gitignore entries', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await buildCommand({});

      const gitignore = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('agentrc managed');
      // Should reference at least some generated paths
      expect(gitignore).toContain('.claude/');
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('build creates manifest', async () => {
    const tempDir = await createTempProject('full');
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await buildCommand({});

      const manifestPath = join(tempDir, '.agentrc', '.manifest.json');
      expect(await pathExists(manifestPath)).toBe(true);

      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      expect(manifest.version).toBe('0.1.0');
      expect(Array.isArray(manifest.files)).toBe(true);
      expect(manifest.files.length).toBeGreaterThan(0);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
