import { describe, expect, test } from 'bun:test';
import { claudeAdapter } from '../../src/adapters/claude.ts';
import { getFullIR, getMinimalIR } from '../helpers.ts';

describe('Claude adapter', () => {
  test('generates .claude/rules/*.md for alwaysApply rules (no frontmatter)', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const tsRule = result.files.find((f) => f.path === '.claude/rules/typescript-strict.md');
    expect(tsRule).toBeDefined();
    expect(tsRule?.content).toContain('No `any` types');
    // Always-on rules should have no frontmatter
    expect(tsRule?.content).not.toContain('---');
  });

  test('generates .claude/rules/*.md for manual rules (no frontmatter)', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const codeStyle = result.files.find((f) => f.path === '.claude/rules/code-style.md');
    expect(codeStyle).toBeDefined();
    expect(codeStyle?.content).toContain('Keep functions small and focused');
    expect(codeStyle?.content).not.toContain('---');
  });

  test('generates .claude/rules/*.md for glob-scoped rules with paths frontmatter', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const reactRule = result.files.find((f) => f.path === '.claude/rules/react-components.md');
    expect(reactRule).toBeDefined();
    expect(reactRule?.content).toContain('---');
    expect(reactRule?.content).toContain('paths:');
    expect(reactRule?.content).toContain('src/components/**/*.tsx');
    expect(reactRule?.content).toContain('src/pages/**/*.tsx');
  });

  test('generates .claude/rules/*.md for description-triggered rules (no frontmatter)', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const dbRule = result.files.find((f) => f.path === '.claude/rules/database-migrations.md');
    expect(dbRule).toBeDefined();
    // Description-triggered rules degrade to always-on (no frontmatter)
    expect(dbRule?.content).not.toContain('---');
  });

  test('does not generate CLAUDE.md', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const claudeMd = result.files.find((f) => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeUndefined();
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

  test('generates agent files with frontmatter', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const agentFile = result.files.find((f) => f.path === '.claude/agents/reviewer.md');
    expect(agentFile).toBeDefined();
    expect(agentFile?.content).toContain('---');
    expect(agentFile?.content).toContain('description: "Use this agent for code review tasks"');
    expect(agentFile?.content).toContain('model: sonnet');
    expect(agentFile?.content).toContain('tools:');
    expect(agentFile?.content).toContain('  - Read');
    expect(agentFile?.content).toContain('  - Bash');
    expect(agentFile?.content).toContain('code review specialist');
  });

  test('reports agents as native feature', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    expect(result.nativeFeatures).toContain('agents');
  });

  test('reports scoped-rules as native feature', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    expect(result.nativeFeatures).toContain('instructions');
    expect(result.nativeFeatures).toContain('scoped-rules');
    expect(result.nativeFeatures).toContain('hooks');
    expect(result.nativeFeatures).toContain('commands');
    expect(result.nativeFeatures).toContain('skills');
  });

  test('reports description and manual rules as degraded', async () => {
    const ir = await getFullIR();
    const result = claudeAdapter.generate(ir);

    const hasDescDegraded = result.degradedFeatures.some((f) =>
      f.includes('description-triggered'),
    );
    const hasManualDegraded = result.degradedFeatures.some((f) => f.includes('manual'));
    expect(hasDescDegraded).toBe(true);
    expect(hasManualDegraded).toBe(true);
  });

  test('generates no settings.json without hooks', async () => {
    const ir = await getMinimalIR();
    const result = claudeAdapter.generate(ir);

    const settings = result.files.find((f) => f.path === '.claude/settings.json');
    expect(settings).toBeUndefined();
  });
});
