import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { claudeAdapter } from '../../src/adapters/claude.ts';
import { buildIR } from '../../src/core/ir.ts';
import { loadAgentrc } from '../../src/core/loader.ts';

const FIXTURES = join(import.meta.dir, '..', 'fixtures');

async function getFullIR() {
  const source = await loadAgentrc(join(FIXTURES, 'full'));
  return buildIR(source);
}

describe('Claude adapter', () => {
  test('generates CLAUDE.md with alwaysApply rules', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const claudeMd = result.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();

    // alwaysApply rule content should be present
    expect(claudeMd?.content).toContain('typescript-strict');
    expect(claudeMd?.content).toContain('No `any` types');
  });

  test('includes manual rules in CLAUDE.md', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const claudeMd = result.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd?.content).toContain('code-style');
    expect(claudeMd?.content).toContain('Keep functions small and focused');
  });

  test('includes glob-scoped rules with file-match annotations', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const claudeMd = result.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd?.content).toContain('react-components');
    expect(claudeMd?.content).toContain(
      'When working on files matching `src/components/**/*.tsx, src/pages/**/*.tsx`',
    );
  });

  test('includes description-triggered rules in CLAUDE.md', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const claudeMd = result.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd?.content).toContain('database-migrations');
    expect(claudeMd?.content).toContain('Apply when writing or modifying database migrations');
  });

  test('generates hooks in settings.json', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const settings = result.files.find((f) => f.path === '.claude/settings.json');
    expect(settings).toBeDefined();

    const parsed = JSON.parse(settings?.content ?? '{}') as Record<string, unknown>;
    expect(parsed).toHaveProperty('hooks');

    const hooks = parsed.hooks as Record<string, unknown>;
    expect(hooks).toHaveProperty('PostToolUse');
    expect(hooks).toHaveProperty('Notification');
  });

  test('generates command files', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const testCmd = result.files.find((f) => f.path === '.claude/commands/test.md');
    expect(testCmd).toBeDefined();
    expect(testCmd?.content).toContain('bun test');

    const reviewCmd = result.files.find((f) => f.path === '.claude/commands/review.md');
    expect(reviewCmd).toBeDefined();
    expect(reviewCmd?.content).toContain('Review all staged changes');
  });

  test('generates skill files', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const skill = result.files.find((f) => f.path === '.claude/skills/debugging/SKILL.md');
    expect(skill).toBeDefined();
    expect(skill?.content).toContain('Reproduce the issue');
  });

  test('reports native features', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    expect(result.nativeFeatures).toContain('instructions');
    expect(result.nativeFeatures).toContain('hooks');
    expect(result.nativeFeatures).toContain('commands');
    expect(result.nativeFeatures).toContain('skills');
  });

  test('reports degraded features for scoped rules', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const hasScopedDegraded = result.degradedFeatures.some((f) => f.includes('scoped-rules'));
    expect(hasScopedDegraded).toBe(true);
  });

  test('generates no settings.json without hooks', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'minimal'));
    const ir = buildIR(source);
    const result = claudeAdapter.generate(ir);

    const settings = result.files.find((f) => f.path === '.claude/settings.json');
    expect(settings).toBeUndefined();
  });
});
