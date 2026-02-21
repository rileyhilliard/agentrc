import { describe, expect, test } from 'bun:test';
import { copilotAdapter } from '../../src/adapters/copilot.ts';
import { getFullIR } from '../helpers.ts';

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

  test('omits hooks from output', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main?.content).not.toContain('## Hooks');
  });

  test('degrades skills to text', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('Skills');
    expect(main?.content).toContain('debugging');
  });

  test('inlines skill reference files when degrading skills', async () => {
    const ir = await getFullIR();
    const result = copilotAdapter.generate(ir);

    const main = result.files.find((f) => f.path === '.github/copilot-instructions.md');
    expect(main?.content).toContain('Binary Search Debugging');
    expect(main?.content).toContain('Rubber Duck Debugging');
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
    const hasSkillsDegraded = result.degradedFeatures.some((f) => f.includes('skills'));
    expect(hasHooksDegraded).toBe(false);
    expect(hasSkillsDegraded).toBe(true);
  });
});
