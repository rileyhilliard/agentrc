import { describe, expect, test } from 'bun:test';
import { clineAdapter } from '../../src/adapters/cline.ts';
import { getFullIR } from '../helpers.ts';

describe('Cline adapter', () => {
  test('files are named .clinerules/{NN}-{name}.md with zero-padded prefixes', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    const ruleFiles = result.files.filter(
      (f) => f.path.startsWith('.clinerules/') && !f.path.includes('00-agentrc'),
    );
    expect(ruleFiles.length).toBe(4);

    for (const f of ruleFiles) {
      // Each file should match the pattern {NN}-{name}.md with a zero-padded two-digit prefix
      expect(f.path).toMatch(/\.clinerules\/\d{2}-.+\.md$/);
    }
  });

  test('highest-priority rule gets the lowest prefix number (01)', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    // typescript-strict is the only high-priority rule, so it should be 01
    const tsRule = result.files.find((f) => f.path.includes('typescript-strict'));
    expect(tsRule).toBeDefined();
    expect(tsRule?.path).toBe('.clinerules/01-typescript-strict.md');
  });

  test('glob-scoped rules get paths frontmatter', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    const reactRule = result.files.find((f) => f.path.includes('react-components'));
    expect(reactRule).toBeDefined();
    expect(reactRule?.content).toContain('---');
    expect(reactRule?.content).toContain('paths:');
    expect(reactRule?.content).toContain('src/components/**/*.tsx');
    expect(reactRule?.content).toContain('src/pages/**/*.tsx');
  });

  test('non-glob rules have no frontmatter', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    // typescript-strict (always), database-migrations (description), code-style (manual)
    const nonGlobNames = ['typescript-strict', 'database-migrations', 'code-style'];
    for (const name of nonGlobNames) {
      const file = result.files.find((f) => f.path.includes(name));
      expect(file).toBeDefined();
      expect(file?.content).not.toContain('---');
    }
  });

  test('generates 00-agentrc-conventions.md when hooks/skills exist', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    const conventions = result.files.find(
      (f) => f.path === '.clinerules/00-agentrc-conventions.md',
    );
    expect(conventions).toBeDefined();
  });

  test('conventions file contains hook events and run commands', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    const conventions = result.files.find(
      (f) => f.path === '.clinerules/00-agentrc-conventions.md',
    );
    expect(conventions).toBeDefined();
    expect(conventions?.content).toContain('post-edit');
    expect(conventions?.content).toContain('pre-commit');
    expect(conventions?.content).toContain('npx prettier --write {file}');
    expect(conventions?.content).toContain('./scripts/pre-commit-checks.sh');
  });

  test('conventions file contains skill content', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    const conventions = result.files.find(
      (f) => f.path === '.clinerules/00-agentrc-conventions.md',
    );
    expect(conventions).toBeDefined();
    expect(conventions?.content).toContain('debugging');
    expect(conventions?.content).toContain('Reproduce the issue');
  });

  test('reports correct native and degraded features', async () => {
    const ir = await getFullIR();
    const result = clineAdapter.generate(ir);

    // Native features
    expect(result.nativeFeatures).toContain('instructions');
    expect(result.nativeFeatures).toContain('scoped-rules');

    // Degraded features
    const hasHooksDegraded = result.degradedFeatures.some((f) => f.includes('hooks'));
    const hasSkillsDegraded = result.degradedFeatures.some((f) => f.includes('skills'));
    expect(hasHooksDegraded).toBe(true);
    expect(hasSkillsDegraded).toBe(true);
  });
});
