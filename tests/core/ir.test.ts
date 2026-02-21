import { describe, expect, test } from 'bun:test';
import { buildIR } from '../../src/core/ir.ts';
import type { LoadedSource } from '../../src/core/loader.ts';

/**
 * Build a minimal LoadedSource with sensible defaults.
 * Override any field by passing partial values.
 */
function makeSource(overrides: Partial<LoadedSource> = {}): LoadedSource {
  return {
    config: overrides.config ?? { version: '1', targets: [], hooks: [] },
    rules: overrides.rules ?? [],
    commands: overrides.commands ?? [],
    skills: overrides.skills ?? [],
    agents: overrides.agents ?? [],
  };
}

describe('buildIR edge cases', () => {
  test('empty source produces IR with empty arrays', () => {
    const source = makeSource();
    const ir = buildIR(source);

    expect(ir.rules).toEqual([]);
    expect(ir.hooks).toEqual([]);
    expect(ir.commands).toEqual([]);
    expect(ir.skills).toEqual([]);
    expect(ir.agents).toEqual([]);
    expect(ir.targets).toEqual([]);
  });

  test('rules are sorted by priority: critical > high > normal > low', () => {
    const source = makeSource({
      rules: [
        {
          name: 'low-rule',
          parsed: { frontmatter: { priority: 'low' }, content: 'low priority content' },
          sourcePath: 'rules/low.md',
        },
        {
          name: 'normal-rule',
          parsed: { frontmatter: { priority: 'normal' }, content: 'normal priority content' },
          sourcePath: 'rules/normal.md',
        },
        {
          name: 'critical-rule',
          parsed: { frontmatter: { priority: 'critical' }, content: 'critical priority content' },
          sourcePath: 'rules/critical.md',
        },
        {
          name: 'high-rule',
          parsed: { frontmatter: { priority: 'high' }, content: 'high priority content' },
          sourcePath: 'rules/high.md',
        },
      ],
    });

    const ir = buildIR(source);
    const names = ir.rules.map((r) => r.name);

    expect(names).toEqual(['critical-rule', 'high-rule', 'normal-rule', 'low-rule']);
  });

  test('rules without explicit priority default to normal', () => {
    const source = makeSource({
      rules: [
        {
          name: 'no-priority',
          parsed: { frontmatter: {}, content: 'content' },
          sourcePath: 'rules/no-priority.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.priority).toBe('normal');
  });

  test('scope is "always" when alwaysApply is true', () => {
    const source = makeSource({
      rules: [
        {
          name: 'always-rule',
          parsed: { frontmatter: { alwaysApply: true }, content: 'always content' },
          sourcePath: 'rules/always.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.scope).toBe('always');
    expect(ir.rules[0]?.alwaysApply).toBe(true);
  });

  test('scope is "glob" when globs are present', () => {
    const source = makeSource({
      rules: [
        {
          name: 'glob-rule',
          parsed: {
            frontmatter: { globs: ['src/**/*.ts', 'lib/**/*.ts'] },
            content: 'glob content',
          },
          sourcePath: 'rules/glob.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.scope).toBe('glob');
    expect(ir.rules[0]?.globs).toEqual(['src/**/*.ts', 'lib/**/*.ts']);
  });

  test('scope is "description" when only description is present', () => {
    const source = makeSource({
      rules: [
        {
          name: 'desc-rule',
          parsed: {
            frontmatter: { description: 'Apply when editing database files' },
            content: 'description content',
          },
          sourcePath: 'rules/desc.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.scope).toBe('description');
    expect(ir.rules[0]?.description).toBe('Apply when editing database files');
  });

  test('scope defaults to "always" when no scope-determining fields are set', () => {
    const source = makeSource({
      rules: [
        {
          name: 'default-rule',
          parsed: { frontmatter: {}, content: 'default content' },
          sourcePath: 'rules/default.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.scope).toBe('always');
  });

  test('scope is "manual" when manual: true is set', () => {
    const source = makeSource({
      rules: [
        {
          name: 'manual-rule',
          parsed: { frontmatter: { manual: true }, content: 'manual content' },
          sourcePath: 'rules/manual.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.scope).toBe('manual');
    expect(ir.rules[0]?.manual).toBe(true);
  });

  test('alwaysApply takes precedence over globs and description for scope', () => {
    const source = makeSource({
      rules: [
        {
          name: 'mixed-rule',
          parsed: {
            frontmatter: {
              alwaysApply: true,
              globs: ['*.ts'],
              description: 'Some description',
            },
            content: 'mixed content',
          },
          sourcePath: 'rules/mixed.md',
        },
      ],
    });

    const ir = buildIR(source);

    // alwaysApply wins even when globs and description are also present
    expect(ir.rules[0]?.scope).toBe('always');
  });

  test('globs takes precedence over description for scope', () => {
    const source = makeSource({
      rules: [
        {
          name: 'glob-desc-rule',
          parsed: {
            frontmatter: {
              globs: ['*.ts'],
              description: 'Some description',
            },
            content: 'content',
          },
          sourcePath: 'rules/glob-desc.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.scope).toBe('glob');
  });

  test('empty globs array does not trigger glob scope', () => {
    const source = makeSource({
      rules: [
        {
          name: 'empty-globs',
          parsed: { frontmatter: { globs: [] }, content: 'content' },
          sourcePath: 'rules/empty-globs.md',
        },
      ],
    });

    const ir = buildIR(source);

    // Empty globs should fall through to 'always' (the default), not 'glob'
    expect(ir.rules[0]?.scope).toBe('always');
  });

  test('targets from config pass through to IR', () => {
    const source = makeSource({
      config: { version: '1', targets: ['claude', 'cursor', 'windsurf'], hooks: [] },
    });

    const ir = buildIR(source);

    expect(ir.targets).toEqual(['claude', 'cursor', 'windsurf']);
  });

  test('hooks from config pass through to IR unchanged', () => {
    const hooks = [
      {
        event: 'post-edit' as const,
        match: '**/*.ts',
        run: 'prettier --write {file}',
        description: 'Format',
      },
      { event: 'pre-commit' as const, run: './lint.sh', description: 'Lint before commit' },
    ];

    const source = makeSource({
      config: { version: '1', targets: [], hooks },
    });

    const ir = buildIR(source);

    expect(ir.hooks).toEqual(hooks);
    // Verify hooks are the same reference (direct passthrough, not copied)
    expect(ir.hooks).toBe(hooks);
  });

  test('commands preserve frontmatter description and aliases', () => {
    const source = makeSource({
      commands: [
        {
          name: 'deploy',
          parsed: {
            frontmatter: { description: 'Deploy to production', aliases: ['d', 'ship'] },
            content: 'Run deploy script',
          },
          sourcePath: 'commands/deploy.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.commands[0]?.name).toBe('deploy');
    expect(ir.commands[0]?.description).toBe('Deploy to production');
    expect(ir.commands[0]?.aliases).toEqual(['d', 'ship']);
    expect(ir.commands[0]?.content).toBe('Run deploy script');
    expect(ir.commands[0]?.sourcePath).toBe('commands/deploy.md');
  });

  test('command without description defaults to empty string', () => {
    const source = makeSource({
      commands: [
        {
          name: 'no-desc',
          parsed: { frontmatter: {}, content: 'Some command content' },
          sourcePath: 'commands/no-desc.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.commands[0]?.description).toBe('');
  });

  test('skills preserve all fields', () => {
    const source = makeSource({
      skills: [
        {
          name: 'testing',
          description: 'Testing methodology',
          content: 'Write tests first',
          files: { 'helpers.ts': 'export function setup() {}', 'README.md': '# Testing' },
          sourcePath: 'skills/testing/SKILL.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.skills[0]?.name).toBe('testing');
    expect(ir.skills[0]?.description).toBe('Testing methodology');
    expect(ir.skills[0]?.content).toBe('Write tests first');
    expect(ir.skills[0]?.files).toEqual({
      'helpers.ts': 'export function setup() {}',
      'README.md': '# Testing',
    });
    expect(ir.skills[0]?.sourcePath).toBe('skills/testing/SKILL.md');
  });

  test('rules with same priority maintain relative order (stable sort)', () => {
    const source = makeSource({
      rules: [
        {
          name: 'alpha',
          parsed: { frontmatter: { priority: 'normal' }, content: 'a' },
          sourcePath: 'rules/alpha.md',
        },
        {
          name: 'beta',
          parsed: { frontmatter: { priority: 'normal' }, content: 'b' },
          sourcePath: 'rules/beta.md',
        },
        {
          name: 'gamma',
          parsed: { frontmatter: { priority: 'normal' }, content: 'c' },
          sourcePath: 'rules/gamma.md',
        },
      ],
    });

    const ir = buildIR(source);
    const names = ir.rules.map((r) => r.name);

    // Same priority means input order is preserved
    expect(names).toEqual(['alpha', 'beta', 'gamma']);
  });

  test('optional fields are omitted from IR rules when not in frontmatter', () => {
    const source = makeSource({
      rules: [
        {
          name: 'bare-rule',
          parsed: { frontmatter: {}, content: 'bare content' },
          sourcePath: 'rules/bare.md',
        },
      ],
    });

    const ir = buildIR(source);
    const rule = ir.rules[0] as Record<string, unknown>;

    // These optional properties should not exist on the output at all
    expect('globs' in rule).toBe(false);
    expect('description' in rule).toBe(false);
    expect('alwaysApply' in rule).toBe(false);
    expect('manual' in rule).toBe(false);
  });

  test('alwaysApply: false does not set scope to always', () => {
    const source = makeSource({
      rules: [
        {
          name: 'not-always',
          parsed: { frontmatter: { alwaysApply: false }, content: 'content' },
          sourcePath: 'rules/not-always.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules[0]?.scope).toBe('manual');
    // alwaysApply is still preserved since it was explicitly set
    expect(ir.rules[0]?.alwaysApply).toBe(false);
  });

  test('agents preserve all fields from frontmatter', () => {
    const source = makeSource({
      agents: [
        {
          name: 'reviewer',
          parsed: {
            frontmatter: {
              description: 'Code review agent',
              model: 'sonnet',
              tools: ['Read', 'Bash'],
            },
            content: 'Review code carefully',
          },
          sourcePath: 'agents/reviewer.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.agents[0]?.name).toBe('reviewer');
    expect(ir.agents[0]?.description).toBe('Code review agent');
    expect(ir.agents[0]?.model).toBe('sonnet');
    expect(ir.agents[0]?.tools).toEqual(['Read', 'Bash']);
    expect(ir.agents[0]?.content).toBe('Review code carefully');
    expect(ir.agents[0]?.sourcePath).toBe('agents/reviewer.md');
  });

  test('agent without description defaults to empty string', () => {
    const source = makeSource({
      agents: [
        {
          name: 'bare-agent',
          parsed: { frontmatter: {}, content: 'Agent content' },
          sourcePath: 'agents/bare.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.agents[0]?.description).toBe('');
  });

  test('optional agent fields are omitted when not in frontmatter', () => {
    const source = makeSource({
      agents: [
        {
          name: 'minimal-agent',
          parsed: { frontmatter: { description: 'Minimal' }, content: 'content' },
          sourcePath: 'agents/minimal.md',
        },
      ],
    });

    const ir = buildIR(source);
    const agent = ir.agents[0] as Record<string, unknown>;

    expect('model' in agent).toBe(false);
    expect('tools' in agent).toBe(false);
  });

  test('multiple rules, commands, skills, agents, and hooks coexist', () => {
    const source = makeSource({
      config: {
        version: '1',
        targets: ['claude'],
        hooks: [{ event: 'pre-commit', run: './check.sh', description: 'Check' }],
      },
      rules: [
        {
          name: 'r1',
          parsed: { frontmatter: { priority: 'high' }, content: 'rule 1' },
          sourcePath: 'rules/r1.md',
        },
        {
          name: 'r2',
          parsed: { frontmatter: {}, content: 'rule 2' },
          sourcePath: 'rules/r2.md',
        },
      ],
      commands: [
        {
          name: 'cmd1',
          parsed: { frontmatter: { description: 'Command 1' }, content: 'do thing' },
          sourcePath: 'commands/cmd1.md',
        },
      ],
      skills: [
        {
          name: 'skill1',
          description: 'Skill one',
          content: 'skill content',
          files: {},
          sourcePath: 'skills/skill1/SKILL.md',
        },
      ],
      agents: [
        {
          name: 'agent1',
          parsed: {
            frontmatter: { description: 'Agent one', model: 'opus' },
            content: 'agent content',
          },
          sourcePath: 'agents/agent1.md',
        },
      ],
    });

    const ir = buildIR(source);

    expect(ir.rules).toHaveLength(2);
    expect(ir.hooks).toHaveLength(1);
    expect(ir.commands).toHaveLength(1);
    expect(ir.skills).toHaveLength(1);
    expect(ir.agents).toHaveLength(1);
    expect(ir.targets).toEqual(['claude']);

    // Rules sorted: high first, then normal
    expect(ir.rules[0]?.name).toBe('r1');
    expect(ir.rules[1]?.name).toBe('r2');
  });
});
