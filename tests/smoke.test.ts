import { describe, expect, test } from 'bun:test';

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
});
