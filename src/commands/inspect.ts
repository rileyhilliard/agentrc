import chalk from 'chalk';
import { getAdapter } from '../adapters/registry.ts';
import { buildIR } from '../core/ir.ts';
import { loadAgentrc } from '../core/loader.ts';

export async function inspectCommand(platform: string): Promise<void> {
  const rootDir = process.cwd();

  // Load .agentrc/ and build IR
  const source = await loadAgentrc(rootDir);
  const ir = buildIR(source);

  // Get the adapter for the platform
  const adapter = getAdapter(platform);
  const result = adapter.generate(ir);

  console.log(chalk.blue(`\nInspecting output for: ${adapter.name}\n`));

  // Native features
  if (result.nativeFeatures.length > 0) {
    console.log(chalk.green('Native features:'));
    for (const feat of result.nativeFeatures) {
      console.log(chalk.green(`  ✓ ${feat}`));
    }
  }

  // Degraded features
  if (result.degradedFeatures.length > 0) {
    console.log(chalk.yellow('\nDegraded features:'));
    for (const feat of result.degradedFeatures) {
      console.log(chalk.yellow(`  ⚠ ${feat}`));
    }
  }

  // Files that would be written
  if (result.files.length > 0) {
    console.log('\nFiles:');
    for (const file of result.files) {
      const lines = file.content.split('\n').length;
      console.log(`  ${file.path} (${lines} lines)`);
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    for (const warn of result.warnings) {
      console.log(chalk.yellow(`  ⚠ ${warn}`));
    }
  }
}
