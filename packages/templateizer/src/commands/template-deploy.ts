import pc from 'picocolors';
import { AdminEndpoints, createAdminClient } from '../api/index.js';
import { buildServiceCommandContext } from '../config/command-context.js';
import { buildTemplateStructure } from '../manifest/build-structure.js';
import { loadWebsiteManifest } from '../manifest/website.js';
import { createSpinner } from '../ui/spinner.js';
import { sym } from '../ui/sym.js';

function requireServiceFields(ctx: ReturnType<typeof buildServiceCommandContext>): string | null {
  if (!ctx.apiUrl) return 'PROXIMA_API_URL';
  if (!ctx.serviceKey) return 'PROXIMA_SERVICE_KEY';
  if (!ctx.templateKey) return 'PROXIMA_TEMPLATE_KEY';
  return null;
}

export async function templateDeployCommand(targetPath: string, argv: string[]): Promise<number> {
  const ctx = buildServiceCommandContext(targetPath, argv);
  const missing = requireServiceFields(ctx);
  if (missing) {
    console.error(sym.err(`${missing} is required ${pc.dim('(set in .proxima/credentials.json, .env, or pass flag)')}`));
    return 1;
  }

  const templateKey = ctx.templateKey!;

  let manifest;
  try {
    manifest = loadWebsiteManifest(targetPath);
  } catch (err: unknown) {
    console.error(sym.err((err as Error).message));
    return 1;
  }

  let structure;
  try {
    structure = buildTemplateStructure(manifest);
  } catch (err: unknown) {
    console.error(sym.err((err as Error).message));
    return 1;
  }

  if (ctx.dryRun) {
    console.log(pc.dim('Dry run — no API call made.\n'));
    console.log(`Template key: ${pc.cyan(templateKey)}`);
    console.log('Structure:');
    console.log(JSON.stringify(structure, null, 2));
    return 0;
  }

  const start = Date.now();
  const spinner = createSpinner(`Deploying template structure for ${pc.cyan(templateKey)}`);
  const client = createAdminClient({ apiUrl: ctx.apiUrl!, serviceKey: ctx.serviceKey! });

  let response: Response;
  try {
    response = await client.patchTemplateStructure(templateKey, structure);
  } catch (err: unknown) {
    spinner.fail(`Network error: ${(err as Error).message}`);
    return 1;
  }

  const text2 = await response.text();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (response.status === 404) {
    spinner.fail(`Template ${pc.cyan(`'${templateKey}'`)} not found.`);
    console.error(sym.hint('Verify PROXIMA_TEMPLATE_KEY matches a template registered in the Proxima admin.'));
    return 1;
  }
  if (response.status === 403) {
    spinner.fail('Access denied. The service key does not have cms:templates:write scope.');
    return 1;
  }
  if (!response.ok) {
    spinner.fail(`Deploy failed ${pc.dim(`(${response.status})`)}: ${text2}`);
    return 1;
  }

  spinner.succeed(`Template ${pc.cyan(`'${templateKey}'`)} structure deployed ${pc.dim(elapsed + 's')}`);
  console.log(sym.hint(`Pages: ${structure.pages.length}  ·  Shell sections: ${structure.shell_sections.length}  ·  Smart collection placeholders: ${Object.keys(structure.smart_collection_placeholders).length}`));
  console.log(sym.hint(`Endpoint: ${AdminEndpoints.cms.templateStructure(templateKey)}`));
  return 0;
}
