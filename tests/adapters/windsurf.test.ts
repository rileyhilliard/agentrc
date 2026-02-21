import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { windsurfAdapter } from '../../src/adapters/windsurf.ts';
import type { IR } from '../../src/core/ir.ts';
import { buildIR } from '../../src/core/ir.ts';
import { loadAgentrc } from '../../src/core/loader.ts';

const FIXTURES = join(import.meta.dir, '..', 'fixtures');

async function getFullIR() {
  const source = await loadAgentrc(join(FIXTURES, 'full'));
  return buildIR(source);
}

describe('Windsurf adapter', () => {
  test('generates .windsurf/rules/*.md files', async () => {
    const ir = await getFullIR();
    const result = windsurfAdapter.generate(ir);

    const ruleFiles = result.files.filter(
      (f) => f.path.startsWith('.windsurf/rules/') && !f.path.includes('agentrc-'),
    );
    expect(ruleFiles.length).toBeGreaterThan(0);
  });

  test('uses trigger: always_on for non-glob rules', async () => {
    const ir = await getFullIR();
    const result = windsurfAdapter.generate(ir);

    const tsFile = result.files.find((f) => f.path.includes('typescript-strict'));
    expect(tsFile).toBeDefined();
    expect(tsFile?.content).toContain('trigger: always_on');
  });

  test('uses trigger: glob with globs for glob-scoped rules', async () => {
    const ir = await getFullIR();
    const result = windsurfAdapter.generate(ir);

    const reactFile = result.files.find((f) => f.path.includes('react-components'));
    expect(reactFile).toBeDefined();
    expect(reactFile?.content).toContain('trigger: glob');
    expect(reactFile?.content).toContain('src/components/**/*.tsx');
  });

  test('warns when a rule exceeds 6000 char limit', () => {
    const bigContent = 'x'.repeat(6100);
    const ir: IR = {
      rules: [
        {
          name: 'huge-rule',
          scope: 'always',
          content: bigContent,
          priority: 'normal',
          sourcePath: 'test.md',
        },
      ],
      hooks: [],
      commands: [],
      skills: [],
      targets: ['windsurf'],
    };
    const result = windsurfAdapter.generate(ir);

    const charWarn = result.warnings.find((w) => w.includes('exceeding'));
    expect(charWarn).toBeDefined();
  });

  test('drops low-priority rules when total exceeds 12000 char limit', () => {
    const makeRule = (name: string, priority: 'high' | 'normal' | 'low', size: number) => ({
      name,
      scope: 'always' as const,
      content: 'x'.repeat(size),
      priority,
      sourcePath: `${name}.md`,
    });

    const ir: IR = {
      rules: [
        makeRule('important', 'high', 5000),
        makeRule('medium', 'normal', 5000),
        makeRule('low-priority', 'low', 5000),
      ],
      hooks: [],
      commands: [],
      skills: [],
      targets: ['windsurf'],
    };
    const result = windsurfAdapter.generate(ir);

    const dropWarn = result.warnings.find((w) => w.includes('Dropping rule'));
    expect(dropWarn).toBeDefined();
    expect(dropWarn).toContain('low-priority');
  });

  test('degrades hooks and commands into conventions file', async () => {
    const ir = await getFullIR();
    const result = windsurfAdapter.generate(ir);

    const convFile = result.files.find((f) => f.path === '.windsurf/rules/agentrc-conventions.md');
    expect(convFile).toBeDefined();
    expect(convFile?.content).toContain('trigger: always_on');
    expect(convFile?.content).toContain('post-edit');
    expect(convFile?.content).toContain('Workflows');
  });

  test('reports degraded features', async () => {
    const ir = await getFullIR();
    const result = windsurfAdapter.generate(ir);

    const hasHooksDegraded = result.degradedFeatures.some((f) => f.includes('hooks'));
    const hasCmdsDegraded = result.degradedFeatures.some((f) => f.includes('commands'));
    expect(hasHooksDegraded).toBe(true);
    expect(hasCmdsDegraded).toBe(true);
  });
});
