import chalk from 'chalk';
import type { OutputFile } from '../adapters/adapter.ts';
import { getAdapter } from '../adapters/registry.ts';
import { buildIR } from '../core/ir.ts';
import { loadAgentrc } from '../core/loader.ts';
import { updateGitignore } from '../output/gitignore.ts';
import { writeOutputFiles } from '../output/writer.ts';

export interface BuildOptions {
  targets?: string; // comma-separated
  dryRun?: boolean;
}

export async function buildCommand(options: BuildOptions): Promise<void> {
  const rootDir = process.cwd();

  // Load .agentrc/ sources
  console.log(chalk.blue('Loading .agentrc/ config...'));
  const source = await loadAgentrc(rootDir);

  // Build IR
  const ir = buildIR(source);

  // Determine targets (from CLI flag or config)
  const targets = options.targets ? options.targets.split(',').map((t) => t.trim()) : ir.targets;

  if (targets.length === 0) {
    console.log(
      chalk.yellow('No targets specified. Add targets to config.yaml or use --targets flag.'),
    );
    return;
  }

  // Run each adapter and collect all output files
  const allFiles: OutputFile[] = [];
  for (const target of targets) {
    try {
      const adapter = getAdapter(target);
      const result = adapter.generate(ir);
      allFiles.push(...result.files);

      console.log(chalk.green(`\n${adapter.name}:`));
      for (const feat of result.nativeFeatures) {
        console.log(chalk.green(`  ✓ ${feat}`));
      }
      for (const feat of result.degradedFeatures) {
        console.log(chalk.yellow(`  ⚠ ${feat}`));
      }
      for (const warn of result.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warn}`));
      }
    } catch (err) {
      console.error(
        chalk.red(`Failed to generate for ${target}: ${err instanceof Error ? err.message : err}`),
      );
    }
  }

  // Write files (or dry-run)
  if (options.dryRun) {
    console.log(chalk.blue('\nDry run — files that would be written:'));
    for (const f of allFiles) {
      console.log(`  ${f.path}`);
    }
    return;
  }

  const result = await writeOutputFiles(allFiles, { rootDir });

  // Update .gitignore
  await updateGitignore(rootDir, result.written);

  // Summary
  console.log(chalk.green(`\n✓ Generated ${result.written.length} files`));
  if (result.backed_up.length > 0) {
    console.log(
      chalk.yellow(`  Backed up ${result.backed_up.length} existing files to .agentrc/.backup/`),
    );
  }
  for (const warn of result.warnings) {
    console.log(chalk.yellow(`  ⚠ ${warn}`));
  }
}
