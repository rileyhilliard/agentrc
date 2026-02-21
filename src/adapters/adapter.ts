import type { IR } from '../core/ir.ts';

export interface OutputFile {
  path: string;
  content: string;
}

export interface AdapterResult {
  files: OutputFile[];
  warnings: string[];
  nativeFeatures: string[];
  degradedFeatures: string[];
}

export interface Adapter {
  name: string;
  generate(ir: IR): AdapterResult;
}
