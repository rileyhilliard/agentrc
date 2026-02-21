import { describe, expect, test } from 'bun:test';
import type { AdapterResult } from '../../src/adapters/adapter.ts';
import { getAdapter, listAdapters } from '../../src/adapters/registry.ts';
import { getFullIR } from '../helpers.ts';

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

  test('only claude adapter includes hooks in output', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result = adapter.generate(ir);

      if (ir.hooks.length > 0) {
        const hooksInNative = result.nativeFeatures.some((f) => f.includes('hook'));

        if (name === 'claude') {
          // Claude should handle hooks natively
          expect(hooksInNative).toBe(true);
        } else {
          // All other adapters omit hooks entirely
          const hooksInDegraded = result.degradedFeatures.some((f) => f.includes('hook'));
          expect(hooksInDegraded).toBe(false);
        }
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

  test('no adapter silently drops skill reference files', async () => {
    const ir = await getFullIR();
    const adapterNames = listAdapters();

    // The fixture debugging skill has references/advanced-techniques.md
    const skillWithRefs = ir.skills.find((s) => Object.keys(s.files).length > 0);
    if (!skillWithRefs) return;

    for (const name of adapterNames) {
      const adapter = getAdapter(name);
      const result = adapter.generate(ir);

      // Either the reference is a separate file (progressive disclosure)
      // or its content is inlined into another file
      const refAsSeparateFile = result.files.some((f) =>
        Object.keys(skillWithRefs.files).some((refPath) => f.path.includes(refPath)),
      );
      const refContentInlined = result.files.some((f) =>
        f.content.includes('Binary Search Debugging'),
      );

      expect(refAsSeparateFile || refContentInlined).toBe(true);
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
