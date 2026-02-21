import matter from 'gray-matter';

export interface ParsedFrontmatter {
  globs?: string[];
  alwaysApply?: boolean;
  manual?: boolean;
  description?: string;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  aliases?: string[];
  model?: string;
  tools?: string[];
}

export interface ParsedMarkdown {
  frontmatter: ParsedFrontmatter;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedMarkdown {
  const { data, content } = matter(raw);

  const frontmatter: ParsedFrontmatter = {};

  // Normalize globs: accept string or string[]
  if (data.globs !== undefined) {
    frontmatter.globs = typeof data.globs === 'string' ? [data.globs] : data.globs;
  }

  if (data.alwaysApply !== undefined) {
    frontmatter.alwaysApply = Boolean(data.alwaysApply);
  }

  if (data.manual !== undefined) {
    frontmatter.manual = Boolean(data.manual);
  }

  if (data.description !== undefined) {
    frontmatter.description = String(data.description);
  }

  // Validate and default priority
  const validPriorities = ['critical', 'high', 'normal', 'low'] as const;
  if (data.priority !== undefined && validPriorities.includes(data.priority)) {
    frontmatter.priority = data.priority as ParsedFrontmatter['priority'];
  } else {
    frontmatter.priority = 'normal';
  }

  if (data.aliases !== undefined) {
    frontmatter.aliases = Array.isArray(data.aliases) ? data.aliases : [data.aliases];
  }

  if (data.model !== undefined) {
    frontmatter.model = String(data.model);
  }

  if (data.tools !== undefined) {
    frontmatter.tools = Array.isArray(data.tools) ? data.tools : [data.tools];
  }

  return {
    frontmatter,
    content: content.trim(),
  };
}
