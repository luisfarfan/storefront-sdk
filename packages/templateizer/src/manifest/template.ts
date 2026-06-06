import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseTemplateManifest, validateTemplateManifest, type TemplateManifest } from '@proxima-io/template-schema';
import { findFiles, readJson } from '../internal/fs.js';

export function collectTemplateManifestPaths(targetPath: string): string[] {
  if (statSync(targetPath).isFile()) {
    return path.basename(targetPath) === 'proxima.template.json' ? [targetPath] : [];
  }
  return findFiles(targetPath, ['.json']).filter((file) => path.basename(file) === 'proxima.template.json');
}

export function findManifestPath(targetPath: string): string | null {
  const direct = path.join(targetPath, 'proxima.template.json');
  if (existsSync(direct)) {
    return direct;
  }
  const matches = collectTemplateManifestPaths(targetPath);
  return matches[0] ?? null;
}

export function loadManifest(targetPath: string): TemplateManifest {
  const manifestPath = findManifestPath(targetPath);
  if (!manifestPath) {
    throw new Error(`No proxima.template.json found under ${targetPath}`);
  }
  return parseTemplateManifest(readJson(manifestPath));
}

export function safeManifest(manifest: unknown): TemplateManifest | null {
  if (!manifest) {
    return null;
  }
  try {
    return parseTemplateManifest(manifest);
  } catch {
    return null;
  }
}

export { validateTemplateManifest };
