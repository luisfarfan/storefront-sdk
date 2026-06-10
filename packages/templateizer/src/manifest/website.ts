import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateWebsiteDeployManifest, type WebsiteDeployManifest } from '@proxima-io/template-schema';
import { readJson } from '../internal/fs.js';
import { sym } from '../ui/sym.js';

export function findWebsiteManifestPath(targetPath: string): string | null {
  const websiteManifest = path.join(targetPath, 'proxima.website.json');
  if (existsSync(websiteManifest)) return websiteManifest;

  const templateManifest = path.join(targetPath, 'proxima.template.json');
  if (existsSync(templateManifest)) {
    console.warn(
      sym.warn('proxima.website.json not found. Falling back to proxima.template.json\n') +
      sym.hint('Consider creating proxima.website.json for the website-deploy command.'),
    );
    return templateManifest;
  }
  return null;
}

export function loadWebsiteManifest(targetPath: string): WebsiteDeployManifest {
  const manifestPath = findWebsiteManifestPath(targetPath);
  if (!manifestPath) {
    throw new Error(
      'proxima.website.json not found. Run from your storefront project root.',
    );
  }

  const raw = readJson(manifestPath);
  const result = validateWebsiteDeployManifest(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid manifest at ${manifestPath}:\n${issues}`);
  }
  return result.data;
}

export function readRawWebsiteManifest(targetPath: string): Record<string, unknown> {
  const manifestPath = findWebsiteManifestPath(targetPath);
  if (!manifestPath) return {};
  return readJson(manifestPath) as Record<string, unknown>;
}
