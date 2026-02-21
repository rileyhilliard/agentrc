import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BLOCK_START = '# >>> agentrc managed (do not edit) >>>';
const BLOCK_END = '# <<< agentrc managed <<<';

// Add or update the agentrc managed block in .gitignore
export async function updateGitignore(rootDir: string, entries: string[]): Promise<void> {
  if (entries.length === 0) return;

  const gitignorePath = join(rootDir, '.gitignore');
  let content = '';

  try {
    content = await readFile(gitignorePath, 'utf-8');
  } catch {
    // .gitignore doesn't exist yet, we'll create it
  }

  const block = buildBlock(entries);

  if (content.includes(BLOCK_START) && content.includes(BLOCK_END)) {
    // Replace the existing managed block
    const startIdx = content.indexOf(BLOCK_START);
    const endIdx = content.indexOf(BLOCK_END) + BLOCK_END.length;
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx);
    content = `${before}${block}${after}`;
  } else {
    // Append the block at the end
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n\n' : '\n';
    content = content.length > 0 ? `${content}${separator}${block}\n` : `${block}\n`;
  }

  await writeFile(gitignorePath, content, 'utf-8');
}

// Remove the agentrc managed block from .gitignore
export async function removeGitignoreBlock(rootDir: string): Promise<void> {
  const gitignorePath = join(rootDir, '.gitignore');
  let content: string;

  try {
    content = await readFile(gitignorePath, 'utf-8');
  } catch {
    // No .gitignore, nothing to remove
    return;
  }

  if (!content.includes(BLOCK_START) || !content.includes(BLOCK_END)) {
    return;
  }

  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END) + BLOCK_END.length;
  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx);

  // Clean up extra blank lines at the junction
  const cleaned = `${before.trimEnd()}${after}`.trimEnd();
  const result = cleaned.length > 0 ? `${cleaned}\n` : '';

  await writeFile(gitignorePath, result, 'utf-8');
}

function buildBlock(entries: string[]): string {
  const sorted = [...entries].sort();
  const lines = [BLOCK_START, ...sorted, BLOCK_END];
  return lines.join('\n');
}
