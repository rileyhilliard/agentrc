import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { cursorAdapter } from '../../src/adapters/cursor.ts';
import { buildIR } from '../../src/core/ir.ts';
import { loadAgentrc } from '../../src/core/loader.ts';

const FIXTURES = join(import.meta.dir, '..', 'fixtures');

async function getFullIR() {
  const source = await loadAgentrc(join(FIXTURES, 'full'));
  return buildIR(source);
}

describe('Cursor adapter', () => {
  test('generates RULE.md per rule in .cursor/rules/', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const ruleFiles = result.files.filter(
      (f) => f.path.startsWith('.cursor/rules/') && !f.path.includes('agentrc-'),
    );
    expect(ruleFiles.length).toBe(4);
  });

  test('alwaysApply rule gets alwaysApply: true frontmatter', async () => {
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

  test('degrades hooks to behavioral instructions rule', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const hooksFile = result.files.find((f) => f.path === '.cursor/rules/agentrc-hooks/RULE.md');
    expect(hooksFile).toBeDefined();
    expect(hooksFile?.content).toContain('alwaysApply: true');
    expect(hooksFile?.content).toContain('post-edit');
    expect(hooksFile?.content).toContain('pre-commit');
  });

  test('degrades commands to description-triggered rule', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const cmdsFile = result.files.find((f) => f.path === '.cursor/rules/agentrc-commands/RULE.md');
    expect(cmdsFile).toBeDefined();
    expect(cmdsFile?.content).toContain('description:');
    expect(cmdsFile?.content).toContain('test');
    expect(cmdsFile?.content).toContain('review');
  });

  test('generates skill files natively', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const skill = result.files.find((f) => f.path === '.cursor/skills/debugging/SKILL.md');
    expect(skill).toBeDefined();
    expect(skill?.content).toContain('Reproduce the issue');
  });

  test('reports native features', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    expect(result.nativeFeatures).toContain('instructions');
    expect(result.nativeFeatures).toContain('scoped-rules');
    expect(result.nativeFeatures).toContain('skills');
  });

  test('reports degraded features', async () => {
    const ir = await getFullIR();
    const result = cursorAdapter.generate(ir);

    const hasHooksDegraded = result.degradedFeatures.some((f) => f.includes('hooks'));
    const hasCmdsDegraded = result.degradedFeatures.some((f) => f.includes('commands'));
    expect(hasHooksDegraded).toBe(true);
    expect(hasCmdsDegraded).toBe(true);
  });
});
