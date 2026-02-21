import { describe, expect, test } from 'bun:test';
import { cursorAdapter } from '../../src/adapters/cursor.ts';
import { getFullIR } from '../helpers.ts';

describe('Cursor adapter', () => {
  test('generates .mdc per rule in .cursor/rules/', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const ruleFiles = result.files.filter(
      (f) => f.path.startsWith('.cursor/rules/') && !f.path.includes('agentrc-'),
    );
    expect(ruleFiles.length).toBe(4);
    // All rule files should use .mdc extension
    for (const f of ruleFiles) {
      expect(f.path).toEndWith('.mdc');
    }
  });

  test('always-on rule gets alwaysApply: true frontmatter', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const tsFile = result.files.find((f) => f.path.includes('typescript-strict'));
    expect(tsFile).toBeDefined();
    expect(tsFile?.content).toContain('alwaysApply: true');
  });

  test('glob-scoped rule gets globs frontmatter', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const reactFile = result.files.find((f) => f.path.includes('react-components'));
    expect(reactFile).toBeDefined();
    expect(reactFile?.content).toContain('globs:');
    expect(reactFile?.content).toContain('src/components/**/*.tsx');
    expect(reactFile?.content).toContain('alwaysApply: false');
  });

  test('description-triggered rule gets description frontmatter', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const dbFile = result.files.find((f) => f.path.includes('database-migrations'));
    expect(dbFile).toBeDefined();
    expect(dbFile?.content).toContain('description:');
    expect(dbFile?.content).toContain('alwaysApply: false');
  });

  test('manual rule gets alwaysApply: false', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const codeFile = result.files.find((f) => f.path.includes('code-style'));
    expect(codeFile).toBeDefined();
    expect(codeFile?.content).toContain('alwaysApply: false');
  });

  test('omits hooks (not supported natively)', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const hooksFile = result.files.find((f) => f.path === '.cursor/rules/agentrc-hooks.mdc');
    expect(hooksFile).toBeUndefined();
  });

  test('generates command files natively', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const testCmd = result.files.find((f) => f.path === '.cursor/commands/test.md');
    expect(testCmd).toBeDefined();
    expect(testCmd?.content).toContain('bun test');

    const reviewCmd = result.files.find((f) => f.path === '.cursor/commands/review.md');
    expect(reviewCmd).toBeDefined();
    expect(reviewCmd?.content).toContain('Review all staged changes');
  });

  test('generates skill files natively', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const skill = result.files.find((f) => f.path === '.cursor/skills/debugging/SKILL.md');
    expect(skill).toBeDefined();
    expect(skill?.content).toContain('Reproduce the issue');
  });

  test('generates agent files natively', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const agentFile = result.files.find((f) => f.path === '.cursor/agents/reviewer.md');
    expect(agentFile).toBeDefined();
    expect(agentFile?.content).toContain('description:');
    expect(agentFile?.content).toContain('model: sonnet');
    expect(agentFile?.content).toContain('code review specialist');
  });

  test('reports native features', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    expect(result.nativeFeatures).toContain('instructions');
    expect(result.nativeFeatures).toContain('scoped-rules');
    expect(result.nativeFeatures).toContain('commands');
    expect(result.nativeFeatures).toContain('skills');
    expect(result.nativeFeatures).toContain('agents');
  });

  test('does not report hooks as degraded', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const hasHooksDegraded = result.degradedFeatures.some((f) => f.includes('hooks'));
    expect(hasHooksDegraded).toBe(false);
  });
});
