import { describe, expect, test } from 'bun:test';
import { codexAdapter } from '../../src/adapters/codex.ts';
import { getFullIR } from '../helpers.ts';

describe('Codex adapter', () => {
  test('generates AGENTS.md as the primary output file', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    const agentsMd = result.files.find((f) => f.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
  });

  test('AGENTS.md contains all 4 fixture rules', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    const agentsMd = result.files.find((f) => f.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();

    const content = agentsMd?.content ?? '';
    expect(content).toContain('typescript-strict');
    expect(content).toContain('react-components');
    expect(content).toContain('database-migrations');
    expect(content).toContain('code-style');
  });

  test('glob rules get file-path annotations', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    const agentsMd = result.files.find((f) => f.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd?.content).toContain('When working on files matching');
    expect(agentsMd?.content).toContain('src/components/**/*.tsx');
  });

  test('description-triggered rules include description text', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    const agentsMd = result.files.find((f) => f.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd?.content).toContain('Apply when writing or modifying database migrations');
  });

  test('hooks are omitted from AGENTS.md', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    const agentsMd = result.files.find((f) => f.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd?.content).not.toContain('## Hooks');
  });

  test('skills get native .agents/ directory files', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    const skillFile = result.files.find((f) => f.path === '.agents/skills/debugging/SKILL.md');
    expect(skillFile).toBeDefined();
    expect(skillFile?.content).toContain('Reproduce the issue');
  });

  test('preserves skill reference files as separate files (progressive disclosure)', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    const refFile = result.files.find(
      (f) => f.path === '.agents/skills/debugging/references/advanced-techniques.md',
    );
    expect(refFile).toBeDefined();
    expect(refFile?.content).toContain('Binary Search Debugging');
  });

  test('reports correct native and degraded features', async () => {
    const ir = await getFullIR();
    const result = codexAdapter.generate(ir);

    // Native features
    expect(result.nativeFeatures).toContain('instructions');
    expect(result.nativeFeatures).toContain('skills');

    // Degraded features
    const hasScopedDegraded = result.degradedFeatures.some((f) => f.includes('scoped-rules'));
    const hasDescDegraded = result.degradedFeatures.some((f) =>
      f.includes('description-triggered'),
    );
    expect(hasScopedDegraded).toBe(true);
    expect(hasDescDegraded).toBe(true);
  });
});
