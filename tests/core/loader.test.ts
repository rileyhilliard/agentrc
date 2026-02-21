import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { loadAgentrc } from '../../src/core/loader.ts';

const FIXTURES = join(import.meta.dir, '..', 'fixtures');

describe('loadAgentrc', () => {
  test('loads the full fixture with all sections', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));

    // Config
    expect(source.config.version).toBe('1');
    expect(source.config.targets).toHaveLength(8);
    expect(source.config.hooks).toHaveLength(2);

    // Rules (sorted alphabetically by filename)
    expect(source.rules).toHaveLength(4);
    const ruleNames = source.rules.map((r) => r.name);
    expect(ruleNames).toContain('typescript-strict');
    expect(ruleNames).toContain('react-components');
    expect(ruleNames).toContain('database-migrations');
    expect(ruleNames).toContain('code-style');

    // Verify frontmatter is parsed on rules
    const tsRule = source.rules.find((r) => r.name === 'typescript-strict');
    expect(tsRule?.parsed.frontmatter.alwaysApply).toBe(true);
    expect(tsRule?.parsed.frontmatter.priority).toBe('high');

    const reactRule = source.rules.find((r) => r.name === 'react-components');
    expect(reactRule?.parsed.frontmatter.globs).toEqual([
      'src/components/**/*.tsx',
      'src/pages/**/*.tsx',
    ]);

    // Commands
    expect(source.commands).toHaveLength(2);
    const cmdNames = source.commands.map((c) => c.name);
    expect(cmdNames).toContain('test');
    expect(cmdNames).toContain('review');

    const testCmd = source.commands.find((c) => c.name === 'test');
    expect(testCmd?.parsed.frontmatter.aliases).toEqual(['t']);

    // Skills
    expect(source.skills).toHaveLength(1);
    expect(source.skills[0]?.name).toBe('debugging');
    expect(source.skills[0]?.description).toBe('Systematic debugging methodology');
    expect(source.skills[0]?.content).toContain('Reproduce the issue');
  });

  test('loads minimal fixture', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'minimal'));

    expect(source.config.version).toBe('1');
    expect(source.config.targets).toEqual(['claude', 'cursor']);
    expect(source.rules).toHaveLength(1);
    expect(source.rules[0]?.name).toBe('typescript');
    expect(source.commands).toHaveLength(0);
    expect(source.skills).toHaveLength(0);
  });

  test('throws on missing .agentrc directory', async () => {
    await expect(loadAgentrc('/tmp/nonexistent-path-agentrc-test')).rejects.toThrow(
      'No .agentrc/ directory found',
    );
  });

  test('throws on missing config.yaml', async () => {
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { mkdir } = await import('node:fs/promises');

    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-test-'));
    await mkdir(join(tempDir, '.agentrc'), { recursive: true });

    await expect(loadAgentrc(tempDir)).rejects.toThrow('No config.yaml found');

    // Cleanup
    const { rm } = await import('node:fs/promises');
    await rm(tempDir, { recursive: true, force: true });
  });

  test('handles missing rules, commands, skills directories gracefully', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');

    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-test-'));
    await mkdir(join(tempDir, '.agentrc'), { recursive: true });
    await writeFile(join(tempDir, '.agentrc', 'config.yaml'), 'version: "1"\n');

    const source = await loadAgentrc(tempDir);
    expect(source.rules).toEqual([]);
    expect(source.commands).toEqual([]);
    expect(source.skills).toEqual([]);

    // Cleanup
    const { rm } = await import('node:fs/promises');
    await rm(tempDir, { recursive: true, force: true });
  });

  test('populates sourcePath on loaded items', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));

    for (const rule of source.rules) {
      expect(rule.sourcePath).toContain('.agentrc/rules/');
      expect(rule.sourcePath).toEndWith('.md');
    }

    for (const cmd of source.commands) {
      expect(cmd.sourcePath).toContain('.agentrc/commands/');
      expect(cmd.sourcePath).toEndWith('.md');
    }

    for (const skill of source.skills) {
      expect(skill.sourcePath).toContain('.agentrc/skills/');
      expect(skill.sourcePath).toEndWith('SKILL.md');
    }
  });
});
