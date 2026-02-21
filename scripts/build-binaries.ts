import { mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import pkg from '../package.json';

const ALL_TARGETS = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-darwin-arm64',
  'bun-darwin-x64',
  'bun-windows-x64',
] as const;

type Target = (typeof ALL_TARGETS)[number];

const PLATFORM_NAMES: Record<Target, string> = {
  'bun-linux-x64': 'agentrc-linux-x64',
  'bun-linux-arm64': 'agentrc-linux-arm64',
  'bun-darwin-arm64': 'agentrc-darwin-arm64',
  'bun-darwin-x64': 'agentrc-darwin-x64',
  'bun-windows-x64': 'agentrc-windows-x64.exe',
};

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    target: { type: 'string' },
  },
});

const targets: Target[] = values.target ? [values.target as Target] : [...ALL_TARGETS];

await mkdir('bin', { recursive: true });

for (const target of targets) {
  const outName = PLATFORM_NAMES[target];
  if (!outName) {
    console.error(`Unknown target: ${target}. Valid targets: ${ALL_TARGETS.join(', ')}`);
    process.exit(1);
  }

  console.log(`Compiling ${outName}...`);

  const proc = Bun.spawn(
    [
      'bun',
      'build',
      'src/cli.ts',
      '--compile',
      `--target=${target}`,
      '--minify',
      `--define=__AGENTRC_VERSION__=${JSON.stringify(pkg.version)}`,
      `--outfile=bin/${outName}`,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error(`Failed to compile ${target}:`);
    console.error(stderr);
    process.exit(1);
  }

  console.log(`  -> bin/${outName}`);
}

console.log(`\nDone! Built ${targets.length} binary(ies) for v${pkg.version}`);
