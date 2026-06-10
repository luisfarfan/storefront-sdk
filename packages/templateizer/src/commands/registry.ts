import { validateTarget } from '../artifacts/validate-target.js';
import { loadManifest } from '../manifest/template.js';
import {
  buildDeploymentConfig,
  hasDeploymentFlags,
  lookupPayload,
  makeRegistryClient,
  requireRegisteredTemplate,
  toApiTemplatePayload,
  writeRegistryState,
} from '../manifest/registry-helpers.js';

export async function registerTemplateCommand(targetPath: string, argv: string[]): Promise<number> {
  const manifest = loadManifest(targetPath);
  const payload = toApiTemplatePayload(manifest, { publicationStatus: 'draft' });
  const dryRun = argv.includes('--dry-run');
  if (dryRun) {
    console.log(JSON.stringify({ action: 'register', lookup: lookupPayload(manifest), payload }, null, 2));
    return 0;
  }

  const client = makeRegistryClient(argv);
  const existing = await client.findTemplate(lookupPayload(manifest));
  const template = existing
    ? await client.updateTemplate(existing.id, payload)
    : await client.createTemplate(payload);
  writeRegistryState(targetPath, manifest, template, payload);
  console.log(JSON.stringify({ action: existing ? 'updated' : 'created', template_id: template.id, publication_status: template.publication_status }, null, 2));
  return 0;
}

export async function deployTemplateCommand(targetPath: string, argv: string[]): Promise<number> {
  const manifest = loadManifest(targetPath);
  const deploymentConfig = buildDeploymentConfig(manifest, argv);
  const dryRun = argv.includes('--dry-run');
  if (dryRun) {
    console.log(JSON.stringify({ action: 'deploy', lookup: lookupPayload(manifest), deployment_config: deploymentConfig }, null, 2));
    return 0;
  }

  const client = makeRegistryClient(argv);
  const existing = await requireRegisteredTemplate(client, manifest);
  const template = await client.patchDeployment(existing.id, deploymentConfig);
  writeRegistryState(targetPath, manifest, template, { deployment_config: deploymentConfig });
  console.log(JSON.stringify({ action: 'deployment_updated', template_id: template.id, deployment_config: template.deployment_config }, null, 2));
  return 0;
}

export async function publishTemplateCommand(targetPath: string, argv: string[]): Promise<number> {
  const manifest = loadManifest(targetPath);
  if (argv.includes('--dry-run')) {
    console.log(JSON.stringify({ action: 'publish', lookup: lookupPayload(manifest), patch: { publication_status: 'published' } }, null, 2));
    return 0;
  }

  const client = makeRegistryClient(argv);
  const existing = await requireRegisteredTemplate(client, manifest);
  const template = await client.publishTemplate(existing.id);
  writeRegistryState(targetPath, manifest, template, { publication_status: 'published' });
  console.log(JSON.stringify({ action: 'published', template_id: template.id, publication_status: template.publication_status }, null, 2));
  return 0;
}

export async function syncTemplateCommand(targetPath: string, argv: string[]): Promise<number> {
  const validation = validateTarget(targetPath);
  if (validation !== 0) {
    return validation;
  }
  const registerCode = await registerTemplateCommand(targetPath, argv);
  if (registerCode !== 0) {
    return registerCode;
  }
  if (hasDeploymentFlags(argv)) {
    const deployCode = await deployTemplateCommand(targetPath, argv);
    if (deployCode !== 0) {
      return deployCode;
    }
  }
  if (argv.includes('--publish')) {
    return publishTemplateCommand(targetPath, argv);
  }
  return 0;
}

export async function statusTemplateCommand(targetPath: string, argv: string[]): Promise<number> {
  const manifest = loadManifest(targetPath);
  const dryRun = argv.includes('--dry-run');
  if (dryRun) {
    console.log(JSON.stringify({ action: 'status', lookup: lookupPayload(manifest) }, null, 2));
    return 0;
  }

  const client = makeRegistryClient(argv);
  const existing = await client.findTemplate(lookupPayload(manifest));
  const visible = existing ? await client.isVisibleInCatalog(existing.id) : false;
  console.log(
    JSON.stringify(
      {
        template_key: manifest.template_key,
        registered: Boolean(existing),
        template_id: existing?.id ?? null,
        publication_status: existing?.publication_status ?? null,
        storefront_visible: visible,
        deployment_config: existing?.deployment_config ?? null,
      },
      null,
      2,
    ),
  );
  return 0;
}
