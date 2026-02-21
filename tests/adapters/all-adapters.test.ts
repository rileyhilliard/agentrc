import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { AdapterResult } from '../../src/adapters/adapter.ts';
import { getAdapter, listAdapters } from '../../src/adapters/registry.ts';
import { buildIR } from '../../src/core/ir.ts';
import { loadAgentrc } from '../../src/core/loader.ts';

const FIXTURES = join(import.meta.dir, '..', 'fixtures');

async function getFullIR() {
  const source = await loadAgentrc(join(FIXTURES, 'full'));
  return buildIR(source);
}

describe('All adapters', () => {
  test('every registered adapter generates without errors', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    expect(adapterNames.length).toBeGreaterThan(0);

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result = adapter.generate(ir);

      expect(result.files).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.nativeFeatures).toBeInstanceOf(Array);
      expect(result.degradedFeatures).toBeInstanceOf(Array);
      expect(result.files.length).toBeGreaterThan(0);
    }
  });

  test('no adapter silently drops rules', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result = adapter.generate(ir);

      // Every rule name should appear somewhere in the output files
      for (const rule of ir.rules) {
        const ruleAppears = result.files.some(
          (f) => f.content.includes(rule.name) || f.path.includes(rule.name),
        );
        expect(ruleAppears).toBe(true);
      }
    }
  });

  test('no adapter silently drops hooks', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result = adapter.generate(ir);

      // Hooks should be represented somewhere: either in files or as degraded features
      if (ir.hooks.length > 0) {
        const hooksAppearInFiles = result.files.some((f) =>
          ir.hooks.some((h) => f.content.includes(h.event) || f.content.includes(h.run)),
        );
        const hooksInNative = result.nativeFeatures.some((f) => f.includes('hook'));
        const hooksInDegraded = result.degradedFeatures.some((f) => f.includes('hook'));

        expect(hooksAppearInFiles || hooksInNative || hooksInDegraded).toBe(true);
      }
    }
  });

  test('no adapter silently drops commands', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result = adapter.generate(ir);

      if (ir.commands.length > 0) {
        const cmdsAppearInFiles = result.files.some((f) =>
          ir.commands.some((c) => f.content.includes(c.name) || f.path.includes(c.name)),
        );
        const cmdsInNative = result.nativeFeatures.some((f) => f.includes('command'));
        const cmdsInDegraded = result.degradedFeatures.some((f) => f.includes('command'));

        expect(cmdsAppearInFiles || cmdsInNative || cmdsInDegraded).toBe(true);
      }
    }
  });

  test('no adapter silently drops skills', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result = adapter.generate(ir);

      if (ir.skills.length > 0) {
        const skillsAppearInFiles = result.files.some((f) =>
          ir.skills.some((s) => f.content.includes(s.name) || f.path.includes(s.name)),
        );
        const skillsInNative = result.nativeFeatures.some((f) => f.includes('skill'));
        const skillsInDegraded = result.degradedFeatures.some((f) => f.includes('skill'));

        expect(skillsAppearInFiles || skillsInNative || skillsInDegraded).toBe(true);
      }
    }
  });

  test('every adapter result has valid AdapterResult shape', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result: AdapterResult = adapter.generate(ir);

      // Every file must have a non-empty path and content
      for (const file of result.files) {
        expect(file.path.length).toBeGreaterThan(0);
        expect(file.content.length).toBeGreaterThan(0);
      }
    }
  });

  test('adapter names match in registry', () => {
    const names = listAdapters();
    for (const name of names) {
      const adapter = getAdapter(name);
      expect(adapter.name).toBe(name);
    }
  });

  test('getAdapter throws on unknown name', () => {
    expect(() => getAdapter('nonexistent-adapter')).toThrow('Unknown adapter');
  });

  test('listAdapters returns all expected adapters', () => {
    const names = listAdapters();
    expect(names).toContain('claude');
    expect(names).toContain('cursor');
    expect(names).toContain('copilot');
    expect(names).toContain('windsurf');
    expect(names).toContain('cline');
    expect(names).toContain('gemini');
    expect(names).toContain('codex');
    expect(names).toContain('generic-markdown');
    expect(names).toContain('aider');
    expect(names).toContain('junie');
    expect(names).toContain('amazonq');
    expect(names).toContain('amp');
    expect(names).toContain('roo');
  });
});
