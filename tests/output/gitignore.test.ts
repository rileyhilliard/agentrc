import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeGitignoreBlock, updateGitignore } from '../../src/output/gitignore.ts';

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'agentrc-gitignore-test-'));
}

describe('updateGitignore', () => {
  test('creates .gitignore with managed block when none exists', async () => {
    const tempDir = await createTempDir();
    try {
      await updateGitignore(tempDir, ['CLAUDE.md', '.cursor/']);

      const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('# >>> agentrc managed (do not edit) >>>');
      expect(content).toContain('# <<< agentrc managed <<<');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('.cursor/');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('appends managed block to existing .gitignore', async () => {
    const tempDir = await createTempDir();
    try {
      await writeFile(join(tempDir, '.gitignore'), 'node_modules/\n.env\n');
      await updateGitignore(tempDir, ['CLAUDE.md']);

      const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('# >>> agentrc managed');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('replaces existing managed block on update', async () => {
    const tempDir = await createTempDir();
    try {
      // Initial write
      await updateGitignore(tempDir, ['CLAUDE.md']);

      // Update with different entries
      await updateGitignore(tempDir, ['CLAUDE.md', '.cursor/', 'GEMINI.md']);

      const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');

      // Should only have one managed block
      const startCount = content.split('# >>> agentrc managed').length - 1;
      expect(startCount).toBe(1);

      // Should have the new entries
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('.cursor/');
      expect(content).toContain('GEMINI.md');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('sorts entries alphabetically', async () => {
    const tempDir = await createTempDir();
    try {
      await updateGitignore(tempDir, ['GEMINI.md', 'AGENTS.md', 'CLAUDE.md']);

      const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      const agentsIdx = content.indexOf('AGENTS.md');
      const claudeIdx = content.indexOf('CLAUDE.md');
      const geminiIdx = content.indexOf('GEMINI.md');

      expect(agentsIdx).toBeLessThan(claudeIdx);
      expect(claudeIdx).toBeLessThan(geminiIdx);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('does nothing with empty entries', async () => {
    const tempDir = await createTempDir();
    try {
      await writeFile(join(tempDir, '.gitignore'), 'node_modules/\n');
      await updateGitignore(tempDir, []);

      const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toBe('node_modules/\n');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('removeGitignoreBlock', () => {
  test('removes managed block from .gitignore', async () => {
    const tempDir = await createTempDir();
    try {
      await writeFile(join(tempDir, '.gitignore'), 'node_modules/\n');
      await updateGitignore(tempDir, ['CLAUDE.md']);

      // Verify block exists
      let content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('# >>> agentrc managed');

      // Remove block
      await removeGitignoreBlock(tempDir);

      content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(content).not.toContain('# >>> agentrc managed');
      expect(content).not.toContain('CLAUDE.md');
      expect(content).toContain('node_modules/');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('handles missing .gitignore gracefully', async () => {
    const tempDir = await createTempDir();
    try {
      // Should not throw
      await removeGitignoreBlock(tempDir);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('handles .gitignore without managed block', async () => {
    const tempDir = await createTempDir();
    try {
      await writeFile(join(tempDir, '.gitignore'), 'node_modules/\n.env\n');
      await removeGitignoreBlock(tempDir);

      const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('results in empty file when only managed block exists', async () => {
    const tempDir = await createTempDir();
    try {
      // Create .gitignore with ONLY the managed block
      await updateGitignore(tempDir, ['CLAUDE.md']);
      await removeGitignoreBlock(tempDir);

      const content = await readFile(join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toBe('');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
