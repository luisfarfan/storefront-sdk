import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TemplateRegistryClient, type WebsiteTemplateRecord } from '@proxima-io/template-registry-client';
import type { TemplateManifest } from '@proxima-io/template-schema';
import { hasDeploymentFlags, readFlag, setFlagValue } from '../internal/flags.js';

export { hasDeploymentFlags, setFlagValue };

export function makeRegistryClient(argv: string[]): TemplateRegistryClient {
  const apiUrl = readFlag(argv, '--api-url') ?? process.env.PROXIMA_API_URL;
  const token = readFlag(argv, '--token') ?? process.env.PROXIMA_API_TOKEN;
  return new TemplateRegistryClient({ apiUrl, token });
}

export function lookupPayload(manifest: TemplateManifest) {
  return { templateKey: manifest.template_key, slug: manifest.slug };
}

export async function requireRegisteredTemplate(client: TemplateRegistryClient, manifest: TemplateManifest) {
  const existing = await client.findTemplate(lookupPayload(manifest));
  if (!existing) {
    throw new Error(`Template '${manifest.template_key}' is not registered. Run register first.`);
  }
  return existing;
}

export function toApiTemplatePayload(manifest: TemplateManifest, options: { publicationStatus?: string } = {}) {
  return {
    name: manifest.name,
    description: manifest.description,
    slug: manifest.slug,
    category: manifest.category,
    industry: manifest.industry,
    tags: manifest.tags,
    preview_image: manifest.preview_image,
    preview_images: manifest.preview_images,
    publication_status: options.publicationStatus ?? 'draft',
    delivery_mode: manifest.deployment_config.runtime_kind === 'external' ? 'external_repository' : 'managed_template',
    website_kind: manifest.category,
    template_key: manifest.template_key,
    code_profile: String(manifest.deployment_config.runtime_bundle ?? manifest.template_key),
    capabilities: { items: manifest.capabilities },
    theme_tokens: manifest.theme_tokens,
    animation_config: manifest.animation_config,
    repository_config: manifest.repository_config,
    deployment_config: manifest.deployment_config,
    renderer_contract: manifest.renderer_contract,
    preview_data: manifest.preview_data,
    structure: {
      smart_collection_placeholders: manifest.smart_collection_placeholders,
      pages: manifest.pages,
    },
  };
}

export function buildDeploymentConfig(manifest: TemplateManifest, argv: string[]) {
  const config: Record<string, unknown> = { ...manifest.deployment_config };
  setFlagValue(config, 'preview_url', readFlag(argv, '--preview-url'));
  setFlagValue(config, 'production_url', readFlag(argv, '--production-url'));
  setFlagValue(config, 'build_id', readFlag(argv, '--build-id'));
  setFlagValue(config, 'artifact_url', readFlag(argv, '--artifact-url'));
  setFlagValue(config, 'status', readFlag(argv, '--status'));
  return config;
}

export function writeRegistryState(
  targetPath: string,
  manifest: TemplateManifest,
  template: WebsiteTemplateRecord,
  payload: unknown,
): void {
  const dir = path.join(targetPath, '.proxima', 'registry');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${manifest.template_key}.json`),
    `${JSON.stringify(
      {
        template_id: template.id,
        template_key: manifest.template_key,
        slug: manifest.slug,
        publication_status: template.publication_status,
        last_registered_at: new Date().toISOString(),
        last_payload_hash: hashPayload(payload),
      },
      null,
      2,
    )}\n`,
  );
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
