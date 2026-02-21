#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { buildCommand } from './commands/build.ts';
import { cleanCommand } from './commands/clean.ts';
import { initCommand } from './commands/init.ts';
import { inspectCommand } from './commands/inspect.ts';
import { migrateCommand } from './commands/migrate.ts';
import { validateCommand } from './commands/validate.ts';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('agentrc')
  .description('Transpile .agentrc/ config into platform-native AI agent features')
  .version(pkg.version);

program
  .command('build')
  .description('Build platform-native config from .agentrc/')
  .option('-t, --targets <platforms>', 'Comma-separated target platforms')
  .option('--dry-run', 'Preview what would be generated without writing files')
  .action(async (options) => {
    try {
      await buildCommand(options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate .agentrc/ config without building')
  .action(async () => {
    try {
      await validateCommand();
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('inspect <platform>')
  .description('Show what a specific platform would receive')
  .action(async (platform) => {
    try {
      await inspectCommand(platform);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Remove all generated files')
  .action(async () => {
    try {
      await cleanCommand();
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new .agentrc/ directory')
  .option('-t, --template <name>', 'Starter template to use')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('migrate')
  .description('Import existing platform config into .agentrc/')
  .action(async () => {
    try {
      await migrateCommand();
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
