import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WebsiteExportResponse } from '@proxima-io/template-registry-client';

export interface FixtureExportPaths {
  manifest: string;
  website: string;
  shell: string;
  compositionsDir: string;
  catalogItems?: string;
  categoryNavTree?: string;
  categoryProducts?: string;
  cart?: string;
}

export interface WriteFixtureExportOptions {
  dryRun?: boolean;
  backup?: boolean;
}

export interface FixtureWritePlanItem {
  relativePath: string;
  action: 'create' | 'update' | 'unchanged';
}

export function resolveFixturePaths(appRoot: string): FixtureExportPaths {
  const fixturesDir = path.join(appRoot, 'src', 'fixtures');
  return {
    manifest: path.join(appRoot, 'proxima.website.json'),
    website: path.join(fixturesDir, 'website.json'),
    shell: path.join(fixturesDir, 'shell.json'),
    compositionsDir: path.join(fixturesDir, 'compositions'),
    catalogItems: path.join(fixturesDir, 'catalog-items.json'),
    categoryNavTree: path.join(fixturesDir, 'category-nav-tree.json'),
    categoryProducts: path.join(fixturesDir, 'category-products.json'),
    cart: path.join(fixturesDir, 'cart.json'),
  };
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fileHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function planWrite(
  filePath: string,
  content: string,
  appRoot: string,
): Promise<FixtureWritePlanItem> {
  const relativePath = path.relative(appRoot, filePath);
  try {
    const existing = await readFile(filePath, 'utf8');
    if (fileHash(existing) === fileHash(content)) {
      return { relativePath, action: 'unchanged' };
    }
    return { relativePath, action: 'update' };
  } catch {
    return { relativePath, action: 'create' };
  }
}

async function writeIfNeeded(
  appRoot: string,
  filePath: string,
  content: string,
  options: WriteFixtureExportOptions,
): Promise<FixtureWritePlanItem> {
  const plan = await planWrite(filePath, content, appRoot);
  if (options.dryRun || plan.action === 'unchanged') {
    return plan;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return plan;
}

export async function writeFixtureExport(
  appRoot: string,
  response: WebsiteExportResponse,
  options: WriteFixtureExportOptions = {},
): Promise<FixtureWritePlanItem[]> {
  const paths = resolveFixturePaths(appRoot);
  const plans: FixtureWritePlanItem[] = [];

  plans.push(
    await writeIfNeeded(appRoot, paths.manifest, stableStringify(response.manifest), options),
  );
  plans.push(
    await writeIfNeeded(appRoot, paths.website, stableStringify(response.fixtures.website), options),
  );
  plans.push(
    await writeIfNeeded(appRoot, paths.shell, stableStringify(response.fixtures.shell), options),
  );

  for (const [key, composition] of Object.entries(response.fixtures.compositions)) {
    const compositionPath = path.join(paths.compositionsDir, `${key}.json`);
    plans.push(
      await writeIfNeeded(appRoot, compositionPath, stableStringify(composition), options),
    );
  }

  if (response.fixtures.catalog_items && paths.catalogItems) {
    plans.push(
      await writeIfNeeded(
        appRoot,
        paths.catalogItems,
        stableStringify(response.fixtures.catalog_items),
        options,
      ),
    );
  }
  if (response.fixtures.category_nav_tree && paths.categoryNavTree) {
    plans.push(
      await writeIfNeeded(
        appRoot,
        paths.categoryNavTree,
        stableStringify(response.fixtures.category_nav_tree),
        options,
      ),
    );
  }
  if (response.fixtures.category_products && paths.categoryProducts) {
    plans.push(
      await writeIfNeeded(
        appRoot,
        paths.categoryProducts,
        stableStringify(response.fixtures.category_products),
        options,
      ),
    );
  }
  if (response.fixtures.cart && paths.cart) {
    plans.push(
      await writeIfNeeded(appRoot, paths.cart, stableStringify(response.fixtures.cart), options),
    );
  }

  return plans;
}
