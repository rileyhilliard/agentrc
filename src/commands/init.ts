import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { pathExists } from '../utils.ts';

export interface InitOptions {
  template?: string;
}

const DEFAULT_CONFIG = `version: "1"
targets:
  - claude
  - cursor
`;

const DEFAULT_RULE = `---
priority: normal
---

# Project Guidelines

Add your project-wide guidelines here.
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const rootDir = process.cwd();
  const agentrcDir = join(rootDir, '.agentrc');

  // Check if .agentrc/ already exists
  if (await pathExists(agentrcDir)) {
    console.log(chalk.yellow('.agentrc/ already exists. Skipping initialization.'));
    return;
  }

  if (options.template && options.template !== 'default') {
    console.log(chalk.yellow(`Template "${options.template}" is not recognized. Using default.`));
  }

  // Create .agentrc/ directory
  await mkdir(agentrcDir, { recursive: true });

  // Create rules/ directory
  const rulesDir = join(agentrcDir, 'rules');
  await mkdir(rulesDir, { recursive: true });

  // Write config.yaml
  const configPath = join(agentrcDir, 'config.yaml');
  await writeFile(configPath, DEFAULT_CONFIG, 'utf-8');

  // Write rules/general.md
  const rulePath = join(rulesDir, 'general.md');
  await writeFile(rulePath, DEFAULT_RULE, 'utf-8');

  console.log(chalk.green('\n✓ Initialized .agentrc/\n'));
  console.log('  Created:');
  console.log('  .agentrc/config.yaml');
  console.log('  .agentrc/rules/general.md');
  console.log(`\n  Run ${chalk.blue('agentrc build')} to generate platform configs.`);
}
