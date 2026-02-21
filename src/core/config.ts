import Ajv from 'ajv';
import { parse as parseYaml } from 'yaml';
import type { Hook } from './ir.ts';

export interface AgentrcConfig {
  version: string;
  targets: string[];
  hooks: Hook[];
}

// Inline the schema so it gets bundled (avoids runtime fs reads that break in node dist builds)
const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://agentrc.dev/schemas/v1/config.json',
  title: 'agentrc config',
  description: 'Configuration for the agentrc transpiler',
  type: 'object',
  required: ['version'],
  properties: {
    version: { type: 'string', enum: ['1'], description: 'Schema version' },
    targets: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'claude',
          'cursor',
          'copilot',
          'windsurf',
          'cline',
          'gemini',
          'codex',
          'aider',
          'junie',
          'amazonq',
          'amp',
          'roo',
          'generic-markdown',
        ],
      },
      description: 'Target platforms to generate config for',
    },
    hooks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['event', 'run', 'description'],
        properties: {
          event: { type: 'string', enum: ['post-edit', 'pre-commit', 'post-create'] },
          match: { type: 'string', description: 'Glob pattern for file matching' },
          run: { type: 'string', description: 'Command to run' },
          description: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

export function parseConfig(content: string): AgentrcConfig {
  // Parse YAML
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse config.yaml as YAML: ${msg}`);
  }

  if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
    throw new Error('config.yaml must contain a YAML object (not null, array, or scalar)');
  }

  // Validate against JSON schema
  const valid = validate(parsed);
  if (!valid) {
    const errors = validate.errors?.map((e) => `${e.instancePath || '/'}: ${e.message}`).join('; ');
    throw new Error(`config.yaml validation failed: ${errors}`);
  }

  const data = parsed as Record<string, unknown>;

  return {
    version: data.version as string,
    targets: (data.targets as string[] | undefined) ?? [],
    hooks: (data.hooks as Hook[] | undefined) ?? [],
  };
}
