import chalk from 'chalk';
import { buildIR } from '../core/ir.ts';
import { loadAgentrc } from '../core/loader.ts';

export async function validateCommand(): Promise<void> {
  const rootDir = process.cwd();

  // Load .agentrc/ (validates config.yaml and parses all files)
  console.log(chalk.blue('Validating .agentrc/ config...'));
  const source = await loadAgentrc(rootDir);

  // Build IR (validates structure)
  const ir = buildIR(source);

  // Report summary
  console.log(chalk.green('\n✓ Config is valid\n'));
  console.log(`  Rules:    ${ir.rules.length}`);
  console.log(`  Hooks:    ${ir.hooks.length}`);
  console.log(`  Commands: ${ir.commands.length}`);
  console.log(`  Skills:   ${ir.skills.length}`);
  console.log(`  Targets:  ${ir.targets.length > 0 ? ir.targets.join(', ') : '(none)'}`);

  // Report warnings for rules with no scope
  const manualRules = ir.rules.filter((r) => r.scope === 'manual');
  if (manualRules.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    for (const rule of manualRules) {
      console.log(
        chalk.yellow(
          `  ⚠ Rule "${rule.name}" has no scope (no alwaysApply, globs, or description)`,
        ),
      );
    }
  }

  if (ir.targets.length === 0) {
    console.log(chalk.yellow('\n  ⚠ No targets configured. Add targets to config.yaml.'));
  }
}
