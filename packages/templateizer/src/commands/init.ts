import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cancel, intro, log, outro } from '@clack/prompts';
import pc from 'picocolors';
import { loadDotEnv } from '../config/dotenv.js';
import { findCredentialsPath, type ProximaCredentials } from '../config/credentials.js';
import { promptHidden, promptText, promptYesNo } from '../ui/prompts.js';

export async function initCommand(targetPath: string): Promise<number> {
  const dotenv = loadDotEnv(targetPath);

  intro(`${pc.bold('Proxima CLI')}  ${pc.dim('— Project Setup')}`);

  log.info(`Creates ${pc.cyan('.proxima/credentials.json')} with your API credentials.`);
  log.info(`This file is never committed (added to ${pc.cyan('.gitignore')} automatically).`);

  const existingCredPath = findCredentialsPath(targetPath);
  if (existingCredPath) {
    const rel = path.relative(process.cwd(), existingCredPath);
    log.warn(`Found existing credentials: ${pc.cyan(rel)}`);
    const overwrite = await promptYesNo('Overwrite?', false);
    if (!overwrite) {
      cancel('Setup cancelled.');
      return 0;
    }
  }

  const defaultApiUrl      = process.env.PROXIMA_API_URL      ?? dotenv.PROXIMA_API_URL      ?? 'https://api.proxima.io';
  const defaultDomain      = process.env.PROXIMA_DOMAIN       ?? dotenv.PROXIMA_DOMAIN       ?? dotenv.PROXIMA_WEBSITE_DOMAIN ?? '';
  const defaultTemplateKey = process.env.PROXIMA_TEMPLATE_KEY ?? dotenv.PROXIMA_TEMPLATE_KEY ?? '';

  const apiUrl      = await promptText('API URL', defaultApiUrl);
  const domain      = await promptText('Website domain  (e.g. mystore.proxima.app)', defaultDomain || undefined);
  const serviceKey  = await promptHidden('Service key     (pxa_live_... or pxa_test_...)');
  const templateKey = await promptText('Template key    (optional — leave blank if not needed)', defaultTemplateKey || undefined);

  if (!domain) {
    log.error('Domain is required.');
    return 1;
  }
  if (!serviceKey) {
    log.error('Service key is required.');
    return 1;
  }

  const creds: ProximaCredentials = {
    api_url:     apiUrl || 'https://api.proxima.io',
    domain:      domain.trim(),
    service_key: serviceKey,
  };
  if (templateKey.trim()) {
    creds.template_key = templateKey.trim();
  }

  const credDir  = path.join(targetPath, '.proxima');
  const credPath = path.join(credDir, 'credentials.json');
  mkdirSync(credDir, { recursive: true });
  writeFileSync(credPath, `${JSON.stringify(creds, null, 2)}\n`);

  const gitignorePath  = path.join(targetPath, '.gitignore');
  const gitignoreEntry = '.proxima/credentials.json';
  let gitignoreUpdated = false;
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (!content.split('\n').some((line) => line.trim() === gitignoreEntry)) {
      writeFileSync(gitignorePath, `${content.trimEnd()}\n${gitignoreEntry}\n`);
      gitignoreUpdated = true;
    }
  } else {
    writeFileSync(gitignorePath, `${gitignoreEntry}\n`);
    gitignoreUpdated = true;
  }

  const relCred = path.relative(process.cwd(), credPath);
  log.success(`Credentials saved to ${pc.cyan(relCred)}`);
  if (gitignoreUpdated) {
    log.success(`Added ${pc.cyan(gitignoreEntry)} to .gitignore`);
  }

  outro(`${pc.green('Ready!')}  Run: ${pc.cyan('proxima-templateizer website-deploy --dry-run')}`);
  return 0;
}
