import { describe, expect, test } from 'bun:test';
import { parseConfig } from '../../src/core/config.ts';

describe('parseConfig', () => {
  test('parses valid config with all fields', () => {
    const yaml = `
version: "1"
targets:
  - claude
  - cursor
hooks:
  - event: post-edit
    match: "**/*.ts"
    run: "npx prettier --write {file}"
    description: "Format on save"
`;
    const config = parseConfig(yaml);
    expect(config.version).toBe('1');
    expect(config.targets).toEqual(['claude', 'cursor']);
    expect(config.hooks).toHaveLength(1);
    expect(config.hooks[0]?.event).toBe('post-edit');
    expect(config.hooks[0]?.match).toBe('**/*.ts');
    expect(config.hooks[0]?.run).toBe('npx prettier --write {file}');
    expect(config.hooks[0]?.description).toBe('Format on save');
  });

  test('requires version field', () => {
    const yaml = `
targets:
  - claude
`;
    expect(() => parseConfig(yaml)).toThrow('validation failed');
  });

  test('rejects invalid version', () => {
    const yaml = `
version: "2"
targets:
  - claude
`;
    expect(() => parseConfig(yaml)).toThrow('validation failed');
  });

  test('defaults empty targets when not specified', () => {
    const yaml = `version: "1"`;
    const config = parseConfig(yaml);
    expect(config.targets).toEqual([]);
  });

  test('defaults empty hooks when not specified', () => {
    const yaml = `version: "1"`;
    const config = parseConfig(yaml);
    expect(config.hooks).toEqual([]);
  });

  test('validates hook event types', () => {
    const yaml = `
version: "1"
hooks:
  - event: on-save
    run: "echo hello"
    description: "Invalid event"
`;
    expect(() => parseConfig(yaml)).toThrow('validation failed');
  });

  test('rejects invalid YAML', () => {
    const yaml = `
version: "1"
  bad: indentation
    really: bad
`;
    expect(() => parseConfig(yaml)).toThrow('Failed to parse config.yaml as YAML');
  });

  test('rejects unknown fields (additionalProperties)', () => {
    const yaml = `
version: "1"
customField: "not allowed"
`;
    expect(() => parseConfig(yaml)).toThrow('validation failed');
  });

  test('rejects null content', () => {
    expect(() => parseConfig('')).toThrow('must contain a YAML object');
  });

  test('rejects scalar content', () => {
    expect(() => parseConfig('just a string')).toThrow('must contain a YAML object');
  });

  test('accepts all valid hook events', () => {
    const yaml = `
version: "1"
hooks:
  - event: post-edit
    run: "cmd1"
    description: "desc1"
  - event: pre-commit
    run: "cmd2"
    description: "desc2"
  - event: post-create
    run: "cmd3"
    description: "desc3"
`;
    const config = parseConfig(yaml);
    expect(config.hooks).toHaveLength(3);
    expect(config.hooks.map((h) => h.event)).toEqual(['post-edit', 'pre-commit', 'post-create']);
  });

  test('rejects hooks with unknown properties', () => {
    const yaml = `
version: "1"
hooks:
  - event: post-edit
    run: "cmd"
    description: "desc"
    extra: "not allowed"
`;
    expect(() => parseConfig(yaml)).toThrow('validation failed');
  });

  test('accepts all valid target names', () => {
    const yaml = `
version: "1"
targets:
  - claude
  - cursor
  - copilot
  - windsurf
  - cline
  - gemini
  - codex
  - aider
  - junie
  - amazonq
  - amp
  - roo
  - generic-markdown
`;
    const config = parseConfig(yaml);
    expect(config.targets).toHaveLength(13);
  });
});
