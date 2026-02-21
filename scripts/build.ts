import pkg from '../package.json';

const result = await Bun.build({
  entrypoints: ['src/cli.ts'],
  outdir: 'dist',
  target: 'node',
  packages: 'external',
  define: {
    __AGENTRC_VERSION__: JSON.stringify(pkg.version),
  },
});

if (!result.success) {
  console.error('Build failed:');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built dist/cli.js (v${pkg.version})`);
