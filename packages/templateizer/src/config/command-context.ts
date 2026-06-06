import { readFlag } from '../internal/flags.js';
import type { ProximaCredentials } from './credentials.js';
import { loadCredentials } from './credentials.js';
import { loadDotEnv } from './dotenv.js';
import { resolveVar } from './resolve-var.js';

export type ServiceCommandContext = {
  targetPath: string;
  argv: string[];
  dotenv: Record<string, string>;
  creds: ProximaCredentials;
  dryRun: boolean;
  apiUrl?: string;
  serviceKey?: string;
  domain?: string;
  templateKey?: string;
};

export function buildServiceCommandContext(targetPath: string, argv: string[]): ServiceCommandContext {
  const dotenv = loadDotEnv(targetPath);
  const creds = loadCredentials(targetPath, readFlag(argv, '--credentials'));

  return {
    targetPath,
    argv,
    dotenv,
    creds,
    dryRun: argv.includes('--dry-run'),
    apiUrl: resolveVar(readFlag(argv, '--api-url'), 'PROXIMA_API_URL', creds.api_url, dotenv),
    serviceKey: resolveVar(readFlag(argv, '--service-key'), 'PROXIMA_SERVICE_KEY', creds.service_key, dotenv),
    domain: resolveVar(readFlag(argv, '--domain'), 'PROXIMA_DOMAIN', creds.domain, dotenv, 'PROXIMA_WEBSITE_DOMAIN'),
    templateKey: resolveVar(readFlag(argv, '--template-key'), 'PROXIMA_TEMPLATE_KEY', creds.template_key, dotenv),
  };
}
