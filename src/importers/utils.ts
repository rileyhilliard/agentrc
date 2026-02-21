import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { isDirectory, pathExists } from '../utils.ts';

export { isDirectory, pathExists };

/** Recursively read all files in a directory, returning relative path -> content pairs.
 * Skips binary files and .DS_Store. */
export async function readDirRecursive(
  dir: string,
  options?: { skipFiles?: string[] },
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const skipFiles = new Set(options?.skipFiles ?? []);

  async function walk(currentDir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(currentDir);
    } catch {
      return;
    }

    for (const entry of entries.sort()) {
      if (entry === '.DS_Store') continue;
      if (skipFiles.has(entry) && currentDir === dir) continue;

      const fullPath = join(currentDir, entry);
      const s = await stat(fullPath);

      if (s.isDirectory()) {
        await walk(fullPath);
      } else if (s.isFile()) {
        // Skip likely binary files
        if (/\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|svg|pdf|zip|gz|tar)$/i.test(entry))
          continue;

        const relPath = relative(dir, fullPath);
        result[relPath] = await readFile(fullPath, 'utf-8');
      }
    }
  }

  await walk(dir);
  return result;
}
