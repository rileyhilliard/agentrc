import { describe, expect, test } from 'bun:test';
import type { IR, Rule } from '../../src/core/ir.ts';

describe('IR types', () => {
  test('Rule type accepts valid rule', () => {
    const rule: Rule = {
      name: 'typescript-strict',
      scope: 'always',
      content: 'Use strict TypeScript.',
      alwaysApply: true,
      priority: 'high',
      sourcePath: '.agentrc/rules/typescript.md',
    };
    expect(rule.name).toBe('typescript-strict');
    expect(rule.scope).toBe('always');
  });

  test('IR type holds all sections', () => {
    const ir: IR = {
      rules: [],
      hooks: [],
      commands: [],
      skills: [],
      targets: ['claude', 'cursor'],
    };
    expect(ir.targets).toEqual(['claude', 'cursor']);
  });
});
