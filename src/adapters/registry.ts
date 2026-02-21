import type { Adapter } from './adapter.ts';
import { claudeAdapter } from './claude.ts';
import { clineAdapter } from './cline.ts';
import { codexAdapter } from './codex.ts';
import { copilotAdapter } from './copilot.ts';
import { cursorAdapter } from './cursor.ts';
import { geminiAdapter } from './gemini.ts';
import { createGenericAdapter, genericMarkdownAdapter } from './generic-markdown.ts';
import { windsurfAdapter } from './windsurf.ts';

// Platform-specific aliases using the generic markdown factory
const aiderAdapter = createGenericAdapter('aider', 'CONVENTIONS.md');
const junieAdapter = createGenericAdapter('junie', '.junie/guidelines.md');
const amazonqAdapter = createGenericAdapter('amazonq', '.amazonq/rules/agentrc.md');
const ampAdapter = createGenericAdapter('amp', 'AGENTS.md');
const rooAdapter = createGenericAdapter('roo', 'AGENTS.md');

const adapters: Record<string, Adapter> = {
  claude: claudeAdapter,
  cursor: cursorAdapter,
  copilot: copilotAdapter,
  windsurf: windsurfAdapter,
  cline: clineAdapter,
  gemini: geminiAdapter,
  codex: codexAdapter,
  'generic-markdown': genericMarkdownAdapter,
  aider: aiderAdapter,
  junie: junieAdapter,
  amazonq: amazonqAdapter,
  amp: ampAdapter,
  roo: rooAdapter,
};

/**
 * Look up an adapter by platform name.
 * Throws if the name isn't recognized.
 */
export function getAdapter(name: string): Adapter {
  const adapter = adapters[name];
  if (!adapter) {
    const available = Object.keys(adapters).join(', ');
    throw new Error(`Unknown adapter "${name}". Available adapters: ${available}`);
  }
  return adapter;
}

/** List all registered adapter names. */
export function listAdapters(): string[] {
  return Object.keys(adapters);
}
