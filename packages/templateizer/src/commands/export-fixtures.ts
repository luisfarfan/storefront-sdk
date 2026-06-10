import pc from 'picocolors';
import {
  WebsiteExportClient,
  WebsiteExportClientError,
  type WebsiteExportScope,
} from '@proxima-io/template-registry-client';
import { loadCredentials } from '../config/credentials.js';
import { loadDotEnv } from '../config/dotenv.js';
import { resolveVar } from '../config/resolve-var.js';
import { writeFixtureExport } from '../export/write-fixture-export.js';
import { readFlag } from '../internal/flags.js';
import { isCI } from '../ui/is-ci.js';
import { promptYesNo } from '../ui/prompts.js';
import { createSpinner } from '../ui/spinner.js';
import { sym } from '../ui/sym.js';

function readScope(argv: string[]): WebsiteExportScope {
  const raw = readFlag(argv, '--scope') ?? 'all';
  if (raw === 'cms' || raw === 'catalog' || raw === 'all') return raw;
  throw new Error(`Invalid --scope: ${raw}. Use cms, catalog, or all.`);
}

function validateCmsExport(response: Awaited<ReturnType<WebsiteExportClient['export']>>): string[] {
  const errors: string[] = [];
  if (!response.manifest || typeof response.manifest !== 'object') {
    errors.push('manifest missing from export response');
  }
  if (!response.fixtures?.website) {
    errors.push('fixtures.website missing from export response');
  }
  if (!response.fixtures?.shell) {
    errors.push('fixtures.shell missing from export response');
  }
  const compositionCount = Object.keys(response.fixtures?.compositions ?? {}).length;
  if (compositionCount === 0) {
    errors.push('no compositions exported');
  }
  return errors;
}

function validateCatalogExport(response: Awaited<ReturnType<WebsiteExportClient['export']>>): string[] {
  const errors: string[] = [];
  const items = response.fixtures?.catalog_items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('catalog_items missing or empty in export response');
    return errors;
  }
  const variantIds = new Set<number>();
  for (const item of items) {
    const slug = (item as Record<string, unknown>).slug;
    if (!slug) errors.push('catalog item missing slug');
    const variants = (item as Record<string, unknown>).variants;
    if (!Array.isArray(variants) || variants.length === 0) {
      errors.push(`catalog item "${String(slug)}" has no variants`);
    } else {
      for (const v of variants) {
        variantIds.add(Number((v as Record<string, unknown>).id));
      }
    }
  }
  const cart = response.fixtures?.cart as Record<string, unknown> | undefined;
  const cartItems = cart?.items;
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    errors.push('cart fixture missing or empty');
  } else {
    for (const line of cartItems) {
      const vid = Number((line as Record<string, unknown>).product_variant_id);
      if (!variantIds.has(vid)) {
        errors.push(`cart variant_id ${vid} not found in exported catalog`);
      }
    }
  }
  const map = response.fixtures?.category_products ?? {};
  for (const [cat, slugs] of Object.entries(map)) {
    for (const slug of slugs) {
      if (!items.some((item) => (item as Record<string, unknown>).slug === slug)) {
        errors.push(`categoryProductMap["${cat}"] references unknown slug "${slug}"`);
      }
    }
  }
  return errors;
}

export async function exportFixturesCommand(targetPath: string, argv: string[]): Promise<number> {
  const dotenv = loadDotEnv(targetPath);
  const creds = loadCredentials(targetPath, readFlag(argv, '--credentials'));

  const apiUrl = resolveVar(readFlag(argv, '--api-url'), 'PROXIMA_API_URL', creds.api_url, dotenv);
  const serviceKey = resolveVar(
    readFlag(argv, '--service-key'),
    'PROXIMA_SERVICE_KEY',
    creds.service_key,
    dotenv,
  );
  const domain = resolveVar(
    readFlag(argv, '--website-domain'),
    'PROXIMA_WEBSITE_DOMAIN',
    creds.domain,
    dotenv,
    'PROXIMA_DOMAIN',
  );
  const fixtureDomain = readFlag(argv, '--fixture-domain');
  const catalogMaxProducts = readFlag(argv, '--catalog-max-products');
  const dryRun = argv.includes('--dry-run');
  const skipPrompt = argv.includes('--yes') || argv.includes('-y') || isCI;

  let scope: WebsiteExportScope;
  try {
    scope = readScope(argv);
  } catch (err) {
    console.error(sym.err((err as Error).message));
    return 1;
  }

  if (!apiUrl) {
    console.error(sym.err('PROXIMA_API_URL is required.'));
    return 1;
  }
  if (!serviceKey) {
    console.error(sym.err('PROXIMA_SERVICE_KEY is required.'));
    return 1;
  }
  if (!domain) {
    console.error(sym.err('PROXIMA_WEBSITE_DOMAIN is required (or pass --website-domain).'));
    return 1;
  }

  if (!skipPrompt && !dryRun) {
    console.log(`\nExport fixtures from: ${pc.bold(pc.cyan(domain))}`);
    console.log(pc.dim(`  scope=${scope}  →  ${targetPath}\n`));
    const confirmed = await promptYesNo('Continue?', true);
    if (!confirmed) {
      console.log('Aborted.');
      return 0;
    }
    console.log();
  }

  const spinner = createSpinner(
    dryRun ? `Planning fixture export from ${pc.cyan(domain)}` : `Exporting fixtures from ${pc.cyan(domain)}`,
  );

  let response;
  try {
    const client = new WebsiteExportClient({ apiUrl, serviceKey });
    response = await client.export({
      websiteDomain: domain,
      scope,
      fixtureDomain,
      catalogMaxProducts: catalogMaxProducts ? Number.parseInt(catalogMaxProducts, 10) : undefined,
    });
  } catch (err) {
    spinner.fail('Export failed');
    if (err instanceof WebsiteExportClientError) {
      console.error(sym.err(err.message));
      if (err.responseText) {
        console.error(pc.dim(err.responseText));
      }
      return 1;
    }
    console.error(sym.err((err as Error).message));
    return 1;
  }

  const plans = await writeFixtureExport(targetPath, response, { dryRun });
  spinner.succeed(dryRun ? 'Dry run complete' : 'Export complete');

  const sectionTypeCount = Array.isArray(response.manifest.section_types)
    ? response.manifest.section_types.length
    : 0;
  const pageCount = Array.isArray(response.manifest.pages)
    ? response.manifest.pages.length
    : response.meta.page_count;

  console.log(
    dryRun
      ? pc.dim('Dry run — no files written.\n')
      : `${sym.ok} Exported fixtures for ${pc.bold(domain)} (scope=${scope})\n`,
  );
  if (scope === 'cms' || scope === 'all') {
    console.log(`  ${pc.bold('proxima.website.json')} (${sectionTypeCount} section types, ${pageCount} pages)`);
    console.log(`  ${pc.bold('src/fixtures/website.json')}`);
    console.log(`  ${pc.bold('src/fixtures/shell.json')}`);
    console.log(
      `  ${pc.bold(`src/fixtures/compositions/`)} (${response.meta.composition_keys.length} files)`,
    );
  }
  if (response.fixtures.catalog_items) {
    console.log(
      `  ${pc.bold('src/fixtures/catalog-items.json')} (${response.fixtures.catalog_items.length} products)`,
    );
    console.log(`  ${pc.bold('src/fixtures/category-nav-tree.json')}`);
    console.log(`  ${pc.bold('src/fixtures/category-products.json')}`);
    console.log(`  ${pc.bold('src/fixtures/cart.json')}`);
  }

  for (const plan of plans) {
    const prefix =
      plan.action === 'create' ? pc.green('[create]')
      : plan.action === 'update' ? pc.yellow('[update]')
      : pc.dim('[unchanged]');
    console.log(`  ${prefix} ${plan.relativePath}`);
  }

  if (dryRun) {
    return 0;
  }

  const validationErrors = [
    ...(scope === 'cms' || scope === 'all' ? validateCmsExport(response) : []),
    ...(scope === 'catalog' || scope === 'all' ? validateCatalogExport(response) : []),
  ];
  if (validationErrors.length > 0) {
    console.error(sym.err('Export validation failed:'));
    for (const error of validationErrors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }

  console.log(`\n${sym.ok} Validation OK`);
  return 0;
}
