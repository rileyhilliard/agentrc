import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { buildIR } from '../../src/core/ir.ts';
import { loadAgentrc } from '../../src/core/loader.ts';

const FIXTURES = join(import.meta.dir, '..', 'fixtures');

describe('buildIR', () => {
  test('builds IR from loaded source', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);

    expect(ir.rules.length).toBe(4);
    expect(ir.hooks.length).toBe(2);
    expect(ir.commands.length).toBe(2);
    expect(ir.skills.length).toBe(1);
    expect(ir.agents.length).toBe(1);
    expect(ir.targets).toHaveLength(8);
  });

  test('determines rule scopes correctly', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);

    const ruleByName = (name: string) => ir.rules.find((r) => r.name === name);

    // No scoping fields -> 'always' (default)
    const tsStrict = ruleByName('typescript-strict');
    expect(tsStrict?.scope).toBe('always');

    // globs present -> 'glob'
    const reactRule = ruleByName('react-components');
    expect(reactRule?.scope).toBe('glob');
    expect(reactRule?.globs).toEqual(['src/components/**/*.tsx', 'src/pages/**/*.tsx']);

    // description only -> 'description'
    const dbRule = ruleByName('database-migrations');
    expect(dbRule?.scope).toBe('description');
    expect(dbRule?.description).toBe('Apply when writing or modifying database migrations');

    // manual: true -> 'manual'
    const codeStyle = ruleByName('code-style');
    expect(codeStyle?.scope).toBe('manual');
  });

  test('sorts rules by priority (high before normal)', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);

    // typescript-strict has priority: high, all others default to normal
    expect(ir.rules[0]?.name).toBe('typescript-strict');
    expect(ir.rules[0]?.priority).toBe('high');

    // Remaining rules should all be normal priority
    for (let i = 1; i < ir.rules.length; i++) {
      expect(ir.rules[i]?.priority).toBe('normal');
    }
  });

  test('converts commands with aliases and descriptions', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);

    const testCmd = ir.commands.find((c) => c.name === 'test');
    expect(testCmd?.description).toBe('Run the test suite for the current module');
    expect(testCmd?.aliases).toEqual(['t']);
    expect(testCmd?.content).toContain('bun test');

    const reviewCmd = ir.commands.find((c) => c.name === 'review');
    expect(reviewCmd?.description).toBe('Review the current changes');
    expect(reviewCmd?.aliases).toBeUndefined();
  });

  test('converts skills with description and content', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);

    expect(ir.skills[0]?.name).toBe('debugging');
    expect(ir.skills[0]?.description).toBe('Systematic debugging methodology');
    expect(ir.skills[0]?.content).toContain('Reproduce the issue');
  });

  test('converts agents with description, model, and tools', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);

    expect(ir.agents[0]?.name).toBe('reviewer');
    expect(ir.agents[0]?.description).toBe('Use this agent for code review tasks');
    expect(ir.agents[0]?.model).toBe('sonnet');
    expect(ir.agents[0]?.tools).toEqual(['Read', 'Bash']);
    expect(ir.agents[0]?.content).toContain('code review specialist');
  });

  test('passes hooks through from config', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);

    expect(ir.hooks[0]?.event).toBe('post-edit');
    expect(ir.hooks[0]?.match).toBe('**/*.{ts,tsx}');
    expect(ir.hooks[0]?.run).toBe('npx prettier --write {file}');

    expect(ir.hooks[1]?.event).toBe('pre-commit');
    expect(ir.hooks[1]?.run).toBe('./scripts/pre-commit-checks.sh');
  });

  test('passes targets through from config', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'full'));
    const ir = buildIR(source);
    expect(ir.targets).toContain('claude');
    expect(ir.targets).toContain('cursor');
    expect(ir.targets).toContain('copilot');
  });

  test('handles minimal fixture with no commands or skills', async () => {
    const source = await loadAgentrc(join(FIXTURES, 'minimal'));
    const ir = buildIR(source);

    expect(ir.rules.length).toBe(1);
    expect(ir.hooks.length).toBe(0);
    expect(ir.commands.length).toBe(0);
    expect(ir.skills.length).toBe(0);
    expect(ir.agents.length).toBe(0);
    expect(ir.targets).toEqual(['claude', 'cursor']);
  });
});
