import { describe, expect, test } from 'bun:test';
import { cp, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dir, '..');
const CLI_PATH = join(PROJECT_ROOT, 'src/cli.ts');
const FIXTURE_DIR = join(import.meta.dir, 'fixtures', 'full', '.agentrc');

async function createTempWithFixture(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-smoke-'));
  await cp(FIXTURE_DIR, join(tempDir, '.agentrc'), { recursive: true });
  return tempDir;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function runCLI(args: string[], cwd?: string) {
  return Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: cwd ?? PROJECT_ROOT,
  });
}

describe('CLI', () => {
  test('--help exits with code 0 and shows usage', async () => {
    const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(0);
    expect(stdout).toContain('agentrc');
    expect(stdout).toContain('build');
    expect(stdout).toContain('validate');
    expect(stdout).toContain('inspect');
  });

  test('--version shows version', async () => {
    const proc = Bun.spawn(['bun', 'run', 'src/cli.ts', '--version'], {
      stdout: 'pipe',
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(0);
    expect(stdout).toContain('0.1.0');
  });

  test('build generates platform files from fixture', async () => {
    const tempDir = await createTempWithFixture();
    try {
      const proc = runCLI(['build', '--targets', 'claude'], tempDir);
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generated');

      const generatedRule = join(tempDir, '.claude', 'rules', 'typescript-strict.md');
      expect(await fileExists(generatedRule)).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('validate reports valid config', async () => {
    const tempDir = await createTempWithFixture();
    try {
      const proc = runCLI(['validate'], tempDir);
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Config is valid');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('init creates .agentrc/ in an empty directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agentrc-smoke-'));
    try {
      const proc = runCLI(['init'], tempDir);
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);

      const configPath = join(tempDir, '.agentrc', 'config.yaml');
      expect(await fileExists(configPath)).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('build then clean removes generated files', async () => {
    const tempDir = await createTempWithFixture();
    try {
      // Build first
      const buildProc = runCLI(['build', '--targets', 'claude'], tempDir);
      const buildExit = await buildProc.exited;
      expect(buildExit).toBe(0);

      const rulesDir = join(tempDir, '.claude', 'rules');
      expect(await fileExists(rulesDir)).toBe(true);

      // Then clean
      const cleanProc = runCLI(['clean'], tempDir);
      const cleanExit = await cleanProc.exited;
      const cleanStdout = await new Response(cleanProc.stdout).text();

      expect(cleanExit).toBe(0);
      expect(cleanStdout).toContain('Removed');

      // Generated files should be gone
      expect(await fileExists(join(tempDir, '.claude', 'rules', 'typescript-strict.md'))).toBe(
        false,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
