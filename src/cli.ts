#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('agentrc')
  .description('Transpile .agentrc/ config into platform-native AI agent features')
  .version('0.1.0');

program
  .command('build')
  .description('Build platform-native config from .agentrc/')
  .option('-t, --targets <platforms>', 'Comma-separated target platforms')
  .option('--dry-run', 'Preview what would be generated without writing files')
  .action((options) => {
    console.log('build command (not yet implemented)', options);
  });

program
  .command('validate')
  .description('Validate .agentrc/ config without building')
  .action(() => {
    console.log('validate command (not yet implemented)');
  });

program
  .command('inspect <platform>')
  .description('Show what a specific platform would receive')
  .action((platform) => {
    console.log(`inspect ${platform} (not yet implemented)`);
  });

program
  .command('clean')
  .description('Remove all generated files')
  .action(() => {
    console.log('clean command (not yet implemented)');
  });

program
  .command('init')
  .description('Initialize a new .agentrc/ directory')
  .option('-t, --template <name>', 'Starter template to use')
  .action((options) => {
    console.log('init command (not yet implemented)', options);
  });

program
  .command('migrate')
  .description('Import existing platform config into .agentrc/')
  .action(() => {
    console.log('migrate command (not yet implemented)');
  });

program.parse();
