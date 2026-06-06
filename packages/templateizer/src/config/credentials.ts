import { existsSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { sym } from '../ui/sym.js';
import { readJson } from '../internal/fs.js';

export interface ProximaCredentials {
  api_url?: string;
  service_key?: string;
  domain?: string;
  template_key?: string;
  api_token?: string;
  s3_bucket?: string;
  s3_region?: string;
}

export function findCredentialsPath(targetPath: string, explicitPath?: string): string | null {
  if (explicitPath) {
    const resolved = path.resolve(process.cwd(), explicitPath);
    if (!existsSync(resolved)) {
      console.error(sym.err(`Credentials file not found: ${pc.cyan(resolved)}`));
      process.exit(1);
    }
    return resolved;
  }
  const candidates = [
    path.join(targetPath, '.proxima', 'credentials.json'),
    path.join(targetPath, 'proxima-credentials.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function loadCredentials(targetPath: string, explicitPath?: string): ProximaCredentials {
  const credPath = findCredentialsPath(targetPath, explicitPath);
  if (!credPath) return {};
  try {
    return readJson(credPath) as ProximaCredentials;
  } catch (err: unknown) {
    console.error(sym.err(`Failed to read credentials file ${pc.cyan(credPath)}: ${(err as Error).message}`));
    process.exit(1);
  }
}
