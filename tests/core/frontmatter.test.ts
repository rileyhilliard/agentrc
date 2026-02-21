import { describe, expect, test } from 'bun:test';
import { parseFrontmatter } from '../../src/core/frontmatter.ts';

describe('parseFrontmatter', () => {
  test('parses frontmatter and content', () => {
    const raw = `---
alwaysApply: true
priority: high
---

Use strict TypeScript.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.alwaysApply).toBe(true);
    expect(result.frontmatter.priority).toBe('high');
    expect(result.content).toBe('Use strict TypeScript.');
  });

  test('handles missing frontmatter', () => {
    const raw = 'Just plain content with no frontmatter.';
    const result = parseFrontmatter(raw);
    expect(result.frontmatter.alwaysApply).toBeUndefined();
    expect(result.frontmatter.globs).toBeUndefined();
    expect(result.frontmatter.description).toBeUndefined();
    expect(result.frontmatter.priority).toBe('normal');
    expect(result.content).toBe('Just plain content with no frontmatter.');
  });

  test('normalizes string glob to array', () => {
    const raw = `---
globs: "src/**/*.ts"
---

Content here.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.globs).toEqual(['src/**/*.ts']);
  });

  test('keeps array globs as array', () => {
    const raw = `---
globs:
  - src/**/*.ts
  - src/**/*.tsx
---

Content here.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.globs).toEqual(['src/**/*.ts', 'src/**/*.tsx']);
  });

  test('defaults priority to normal', () => {
    const raw = `---
alwaysApply: true
---

Some content.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.priority).toBe('normal');
  });

  test('defaults priority to normal for invalid priority value', () => {
    const raw = `---
priority: urgent
---

Content.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.priority).toBe('normal');
  });

  test('trims content whitespace', () => {
    const raw = `---
alwaysApply: true
---


   Content with surrounding whitespace.

`;

    const result = parseFrontmatter(raw);
    expect(result.content).toBe('Content with surrounding whitespace.');
  });

  test('handles empty frontmatter', () => {
    const raw = `---
---

Content after empty frontmatter.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.priority).toBe('normal');
    expect(result.content).toBe('Content after empty frontmatter.');
  });

  test('parses manual field', () => {
    const raw = `---
manual: true
---

Some manual-only rule.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.manual).toBe(true);
  });

  test('parses description field', () => {
    const raw = `---
description: "Apply for database work"
---

Migration rules here.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.description).toBe('Apply for database work');
  });

  test('parses aliases as array', () => {
    const raw = `---
aliases:
  - t
  - test-cmd
---

Test command content.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.aliases).toEqual(['t', 'test-cmd']);
  });

  test('normalizes single alias string to array', () => {
    const raw = `---
aliases: t
---

Content.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.aliases).toEqual(['t']);
  });

  test('accepts all valid priority values', () => {
    for (const priority of ['critical', 'high', 'normal', 'low']) {
      const raw = `---\npriority: ${priority}\n---\n\nContent.`;
      const result = parseFrontmatter(raw);
      expect(result.frontmatter.priority).toBe(priority);
    }
  });

  test('parses model field as string', () => {
    const raw = `---
model: sonnet
---

Content.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.model).toBe('sonnet');
  });

  test('parses tools as array', () => {
    const raw = `---
tools:
  - Read
  - Bash
---

Content.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.tools).toEqual(['Read', 'Bash']);
  });

  test('normalizes single tool string to array', () => {
    const raw = `---
tools: Read
---

Content.`;

    const result = parseFrontmatter(raw);
    expect(result.frontmatter.tools).toEqual(['Read']);
  });
});
