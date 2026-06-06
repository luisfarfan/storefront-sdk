import pc from 'picocolors';
import { AdminEndpoints, createAdminClient } from '../api/index.js';
import { buildServiceCommandContext } from '../config/command-context.js';
import { readFlag } from '../internal/flags.js';
import { buildManifestPublishBody, buildTemplateStructure } from '../manifest/build-structure.js';
import { findWebsiteManifestPath, loadWebsiteManifest, readRawWebsiteManifest } from '../manifest/website.js';
import type { ManifestPublishValidationError } from '../types/template-structure.js';
import { createSpinner } from '../ui/spinner.js';
import { sym } from '../ui/sym.js';

function requireServiceFields(ctx: ReturnType<typeof buildServiceCommandContext>): string | null {
  if (!ctx.apiUrl) return 'PROXIMA_API_URL';
  if (!ctx.serviceKey) return 'PROXIMA_SERVICE_KEY';
  if (!ctx.templateKey) return 'PROXIMA_TEMPLATE_KEY';
  return null;
}

export async function templateCreateCommand(targetPath: string, argv: string[]): Promise<number> {
  const ctx = buildServiceCommandContext(targetPath, argv);
  const missing = requireServiceFields(ctx);
  if (missing) {
    console.error(sym.err(`${missing} is required ${pc.dim('(set in .proxima/credentials.json, .env, or pass flag)')}`));
    return 1;
  }

  const templateKey = ctx.templateKey!;
  const publishManifest = argv.includes('--publish-manifest');

  const nameOverride         = readFlag(argv, '--name');
  const descOverride         = readFlag(argv, '--description');
  const categoryOverride     = readFlag(argv, '--category');
  const pricingTierOverride  = readFlag(argv, '--pricing-tier');
  const demoUrlOverride      = readFlag(argv, '--demo-url');
  const previewImageOverride = readFlag(argv, '--preview-image');
  const tagsOverride         = readFlag(argv, '--tags');

  let manifest = null;
  const manifestPath = findWebsiteManifestPath(targetPath);
  if (manifestPath) {
    try {
      manifest = loadWebsiteManifest(targetPath);
    } catch (err: unknown) {
      console.error(sym.err((err as Error).message));
      return 1;
    }
  }

  const rawManifest = readRawWebsiteManifest(targetPath);
  const marketplaceMeta = (rawManifest.marketplace_metadata ?? {}) as Record<string, unknown>;
  const topLevel = rawManifest;

  const tags = tagsOverride
    ? tagsOverride.split(',').map((t) => t.trim()).filter(Boolean)
    : ((marketplaceMeta.tags ?? topLevel.tags) as string[] | undefined) ?? [];

  const payload: Record<string, unknown> = {
    template_key: templateKey,
    name:
      nameOverride ??
      (marketplaceMeta.name as string | undefined) ??
      (topLevel.name as string | undefined) ??
      templateKey,
    description:
      descOverride ??
      (marketplaceMeta.short_description as string | undefined) ??
      (marketplaceMeta.description as string | undefined) ??
      (topLevel.short_description as string | undefined) ??
      (topLevel.description as string | undefined) ??
      '',
    category:
      categoryOverride ??
      (marketplaceMeta.category as string | undefined) ??
      (topLevel.category as string | undefined) ??
      'ecommerce',
    pricing_tier:
      pricingTierOverride ??
      (marketplaceMeta.pricing_tier as string | undefined) ??
      'free',
    demo_url:
      demoUrlOverride ??
      (marketplaceMeta.demo_url as string | undefined) ??
      `https://${templateKey}.proxima.pe`,
    preview_image:
      previewImageOverride ??
      (marketplaceMeta.preview_image as string | undefined) ??
      (topLevel.preview_image as string | undefined) ??
      null,
    tags,
    features: ((marketplaceMeta.features ?? topLevel.features) as string[] | undefined) ?? [],
    preview_images:
      ((marketplaceMeta.preview_images ?? topLevel.preview_images) as unknown[] | undefined) ?? [],
    color_palette:
      ((marketplaceMeta.color_palette ?? topLevel.color_palette) as unknown | undefined) ?? null,
    industry: (topLevel.industry as string | undefined) ?? null,
  };

  let structure = null;
  if (publishManifest) {
    if (!manifest) {
      console.error(sym.err(`proxima.website.json not found — required for ${pc.yellow('--publish-manifest')}`));
      return 1;
    }
    try {
      structure = buildTemplateStructure(manifest);
    } catch (err: unknown) {
      console.error(sym.err((err as Error).message));
      return 1;
    }
  }

  if (ctx.dryRun) {
    console.log(pc.dim('Dry run — no API call made.\n'));
    console.log(`Template key: ${pc.cyan(templateKey)}`);
    console.log('Action: POST (create) or PATCH (update) — determined at runtime by GET check');
    console.log('\nPayload:');
    console.log(JSON.stringify(payload, null, 2));
    if (publishManifest && structure) {
      console.log(`\nManifest publish endpoint: ${pc.cyan(AdminEndpoints.cms.templatePublish(templateKey))}`);
      console.log(pc.dim('(The API validates required values and uploads the manifest to S3.)'));
      console.log('\nStructure:');
      console.log(JSON.stringify(structure, null, 2));
    }
    return 0;
  }

  const start = Date.now();
  const client = createAdminClient({ apiUrl: ctx.apiUrl!, serviceKey: ctx.serviceKey! });
  const spinner = createSpinner(`Checking template ${pc.cyan(`'${templateKey}'`)}`);

  let existingId: string | null = null;
  try {
    const { existingId: id, response } = await client.checkTemplateExists(templateKey);
    if (response.status === 403) {
      spinner.fail('Access denied. The service key does not have cms:templates:write scope.');
      return 1;
    }
    if (!response.ok && response.status !== 404) {
      const text2 = await response.text();
      spinner.fail(`Failed to check template existence ${pc.dim(`(${response.status})`)}: ${text2}`);
      return 1;
    }
    existingId = id;
  } catch (err: unknown) {
    spinner.fail(`Network error checking template: ${(err as Error).message}`);
    return 1;
  }

  const action = existingId ? 'updated' : 'created';
  spinner.update(existingId ? `Updating template ${pc.cyan(`'${templateKey}'`)}` : `Creating template ${pc.cyan(`'${templateKey}'`)}`);

  let rowResponse: Response;
  try {
    rowResponse = await client.upsertWebsiteTemplate(existingId, payload);
  } catch (err: unknown) {
    spinner.fail(`Network error: ${(err as Error).message}`);
    return 1;
  }

  const rowText = await rowResponse.text();
  if (rowResponse.status === 403) {
    spinner.fail('Access denied. The service key does not have cms:templates:write scope.');
    return 1;
  }
  if (!rowResponse.ok) {
    spinner.fail(`Template ${action} failed ${pc.dim(`(${rowResponse.status})`)}: ${rowText}`);
    return 1;
  }

  let createdRow: Record<string, unknown> = {};
  try { createdRow = JSON.parse(rowText) as Record<string, unknown>; } catch { /* ignore */ }

  const elapsed1 = ((Date.now() - start) / 1000).toFixed(1);
  spinner.succeed(`Template ${pc.cyan(`'${templateKey}'`)} ${action} ${pc.dim(`(id=${createdRow.id ?? '?'})`)} ${pc.dim(elapsed1 + 's')}`);

  if (!publishManifest || !manifest) {
    return 0;
  }

  const spinner2 = createSpinner('Validating + publishing manifest');
  const publishBody = buildManifestPublishBody(manifest);

  let publishResponse: Response;
  try {
    publishResponse = await client.publishWebsiteTemplate(templateKey, publishBody);
  } catch (err: unknown) {
    spinner2.fail(`Network error publishing manifest: ${(err as Error).message}`);
    return 1;
  }

  const publishText = await publishResponse.text();
  const elapsed2 = ((Date.now() - start) / 1000).toFixed(1);

  if (publishResponse.status === 404) {
    spinner2.fail(`Template ${pc.cyan(`'${templateKey}'`)} not found when publishing (unexpected after create/update).`);
    return 1;
  }
  if (publishResponse.status === 403) {
    spinner2.fail('Access denied publishing manifest. The service key needs cms:templates:write scope.');
    return 1;
  }
  if (publishResponse.status === 422) {
    spinner2.fail('Manifest validation failed — required values missing on one or more sections.');
    try {
      const errBody = JSON.parse(publishText) as { detail?: { errors?: ManifestPublishValidationError[] } };
      const errors = errBody?.detail?.errors ?? [];
      if (errors.length > 0) {
        console.log('');
        for (const e of errors) {
          console.log(`  ${pc.red('✗')} ${pc.dim(e.location)}`);
          console.log(`    ${pc.bold(e.section_type)}.${e.attribute} — ${e.message}`);
        }
        console.log('');
        console.log(sym.hint('Fill the missing values in proxima.website.json and re-run.'));
      } else {
        console.log(publishText);
      }
    } catch {
      console.log(publishText);
    }
    return 1;
  }
  if (!publishResponse.ok) {
    spinner2.fail(`Manifest publish failed ${pc.dim(`(${publishResponse.status})`)}: ${publishText}`);
    return 1;
  }

  let publishedBody = {};
  try { publishedBody = JSON.parse(publishText); } catch { /* ignore */ }
  const published = publishedBody as { manifest_s3_key?: string; manifest_s3_version_id?: string | null; sections_validated?: number };

  const pageCount = manifest.pages.length;
  const shellCount = (manifest.shell_sections ?? []).length;
  const placeholderCount = Object.keys(manifest.smart_collection_placeholders ?? {}).length;
  const sectionsValidated = published.sections_validated ?? (pageCount + shellCount);

  spinner2.succeed(`Manifest published ${pc.dim(elapsed2 + 's')} ${pc.dim(`(${sectionsValidated} section(s) validated)`)}`);
  console.log(sym.hint(`Pages: ${pageCount}  ·  Shell sections: ${shellCount}  ·  Smart collection placeholders: ${placeholderCount}`));
  if (published.manifest_s3_key) {
    console.log(sym.hint(`Manifest: ${pc.cyan(published.manifest_s3_key)} ${pc.dim(`VersionId=${published.manifest_s3_version_id ?? 'null'}`)}`));
  }
  return 0;
}

export async function templatePublishCommand(targetPath: string, argv: string[]): Promise<number> {
  const args = argv.includes('--publish-manifest') ? argv : [...argv, '--publish-manifest'];
  return templateCreateCommand(targetPath, args);
}
