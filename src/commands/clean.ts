import chalk from 'chalk';
import { removeGitignoreBlock } from '../output/gitignore.ts';
import { cleanGeneratedFiles, readManifest } from '../output/writer.ts';

export async function cleanCommand(): Promise<void> {
  const rootDir = process.cwd();

  // Check for manifest
  const manifest = await readManifest(rootDir);
  if (!manifest) {
    console.log(chalk.yellow('No manifest found. Nothing to clean.'));
    return;
  }

  // Delete all tracked files
  const removed = await cleanGeneratedFiles(rootDir);

  // Remove .gitignore managed block
  await removeGitignoreBlock(rootDir);

  // Report what was removed
  if (removed.length > 0) {
    console.log(chalk.green(`\n✓ Removed ${removed.length} generated files:`));
    for (const file of removed) {
      console.log(`  ${file}`);
    }
  } else {
    console.log(chalk.yellow('No generated files found to remove.'));
  }
}
