import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function loadDotEnv(targetPath: string): Record<string, string> {
  const envPath = path.join(targetPath, '.env');
  const result: Record<string, string> = {};
  if (!existsSync(envPath)) return result;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}
