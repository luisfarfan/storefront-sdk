import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function findFiles(root: string, extensions: string[]): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const results: string[] = [];
  for (const item of readdirSync(root)) {
    if (item === 'node_modules' || item === 'dist' || item === '.astro' || item === '.proxima') {
      continue;
    }
    const fullPath = path.join(root, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findFiles(fullPath, extensions));
    } else if (extensions.some((extension) => fullPath.endsWith(extension))) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

export function routeFromPageFile(relativeFile: string): string {
  const withoutExt = relativeFile.replace(/\.(astro|tsx|ts)$/u, '');
  const normalized = withoutExt
    .replace(/(^|\/)index$/u, '$1')
    .replace(/\[\.{3}(.+?)\]/gu, '{$1*}')
    .replace(/\[(.+?)\]/gu, '{$1}');
  const route = `/${normalized}`.replace(/\/+/gu, '/').replace(/\/$/u, '');
  return route || '/';
}

export function discoverPages(targetPath: string): Array<{ file: string; path: string }> {
  const pagesDir = path.join(targetPath, 'src', 'pages');
  if (!existsSync(pagesDir)) {
    return [];
  }
  return findFiles(pagesDir, ['.astro', '.tsx', '.ts']).map((file) => ({
    file: path.relative(targetPath, file),
    path: routeFromPageFile(path.relative(pagesDir, file)),
  }));
}
