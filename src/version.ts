// Injected at build time by scripts/build.ts and scripts/build-binaries.ts via Bun's `define` option
declare const __AGENTRC_VERSION__: string;

function getDevVersion(): string {
  try {
    const { readFileSync } = require('node:fs');
    const { resolve, dirname } = require('node:path');
    const { fileURLToPath } = require('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(resolve(dir, '../package.json'), 'utf-8')) as {
      version: string;
    };
    return pkg.version;
  } catch {
    return '0.0.0-dev';
  }
}

export const VERSION: string =
  typeof __AGENTRC_VERSION__ !== 'undefined' ? __AGENTRC_VERSION__ : getDevVersion();
