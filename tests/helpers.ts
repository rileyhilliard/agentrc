import { join } from 'node:path';
import { buildIR } from '../src/core/ir.ts';
import { loadAgentrc } from '../src/core/loader.ts';

export const FIXTURES = join(import.meta.dir, 'fixtures');

export async function getFullIR() {
  const source = await loadAgentrc(join(FIXTURES, 'full'));
  return buildIR(source);
}

export async function getMinimalIR() {
  const source = await loadAgentrc(join(FIXTURES, 'minimal'));
  return buildIR(source);
}
