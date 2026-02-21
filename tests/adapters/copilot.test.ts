import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { copilotAdapter } from '../../src/adapters/copilot.ts';
import { buildIR } from '../../src/core/ir.ts';
import { loadAgentrc } from '../../src/core/loader.ts';

const FIXTURES = join(import.meta.dir, '..', 'fixtures');

async function getFullIR() {
  const source = await loadAgentrc(join(FIXTURES, 'full'));
  return buildIR(source);
}

describe('Copilot adapter', () => {
  test('generates copilot-instructions.md with always-apply rules', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main).toBeDefined();
    expect(main?.content).toContain('typescript-strict');
    expect(main?.content).toContain('No `any` types');
  });

  test('includes manual rules in main instructions', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('code-style');
    expect(main?.content).toContain('Keep functions small and focused');
  });

  test('generates scoped .instructions.md files for glob rules', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const reactInstr = result.files.find(
      (f) => f.path === '.github/instructions/react-components.instructions.md',
    );
    expect(reactInstr).toBeDefined();
    expect(reactInstr?.content).toContain('applyTo:');
    expect(reactInstr?.content).toContain('src/components/**/*.tsx');
  });

  test('degrades hooks to main instructions', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('post-edit');
    expect(main?.content).toContain('npx prettier --write {file}');
  });

  test('degrades commands to workflows section', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('Workflows');
    expect(main?.content).toContain('test');
    expect(main?.content).toContain('review');
  });

  test('degrades skills to text', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('Skills');
    expect(main?.content).toContain('debugging');
  });

  test('reports native scoped-rules feature', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    expect(result.nativeFeatures).toContain('scoped-rules');
  });

  test('reports degraded features', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const hasHooksDegraded = result.degradedFeatures.some((f) => f.includes('hooks'));
    const hasCmdsDegraded = result.degradedFeatures.some((f) => f.includes('commands'));
    const hasSkillsDegraded = result.degradedFeatures.some((f) => f.includes('skills'));
    expect(hasHooksDegraded).toBe(true);
    expect(hasCmdsDegraded).toBe(true);
    expect(hasSkillsDegraded).toBe(true);
  });
});
