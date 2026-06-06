import pc from 'picocolors';
import { WebsiteDeployClient, WebsiteDeployClientError } from '@proxima-io/template-registry-client';
import { loadCredentials } from '../config/credentials.js';
import { loadDotEnv } from '../config/dotenv.js';
import { resolveVar } from '../config/resolve-var.js';
import { readFlag, readFlagAll } from '../internal/flags.js';
import { loadWebsiteManifest } from '../manifest/website.js';
import { isCI } from '../ui/is-ci.js';
import { promptYesNo } from '../ui/prompts.js';
import { createSpinner } from '../ui/spinner.js';
import { sym } from '../ui/sym.js';

export async function websiteDeployCommand(targetPath: string, argv: string[]): Promise<number> {
  const dotenv = loadDotEnv(targetPath);
  const creds  = loadCredentials(targetPath, readFlag(argv, '--credentials'));

  const apiUrl     = resolveVar(readFlag(argv, '--api-url'),     'PROXIMA_API_URL',     creds.api_url,     dotenv);
  const serviceKey = resolveVar(readFlag(argv, '--service-key'), 'PROXIMA_SERVICE_KEY', creds.service_key, dotenv);
  const domain     = resolveVar(readFlag(argv, '--domain'),      'PROXIMA_DOMAIN',      creds.domain,      dotenv, 'PROXIMA_WEBSITE_DOMAIN');
  const dryRun     = argv.includes('--dry-run');
  const force      = argv.includes('--force');
  const skipPrompt = argv.includes('--yes') || argv.includes('-y') || isCI;
  const pageFilter = readFlagAll(argv, '--page');

  if (!apiUrl) {
    console.error(sym.err('PROXIMA_API_URL is required.'));
    console.error(sym.hint('Set it in .proxima/credentials.json or pass --api-url'));
    console.error(sym.hint(`Run: ${pc.cyan('proxima-templateizer init')}`));
    return 1;
  }
  if (!serviceKey) {
    console.error(sym.err('PROXIMA_SERVICE_KEY is required.'));
    console.error(sym.hint('Set it in .proxima/credentials.json or pass --service-key'));
    console.error(sym.hint(`Run: ${pc.cyan('proxima-templateizer init')}`));
    return 1;
  }
  if (!domain) {
    console.error(sym.err('PROXIMA_DOMAIN is required.'));
    console.error(sym.hint('Set it in .proxima/credentials.json or pass --domain'));
    console.error(sym.hint(`Run: ${pc.cyan('proxima-templateizer init')}`));
    return 1;
  }

  let manifest;
  try {
    manifest = loadWebsiteManifest(targetPath);
  } catch (err: unknown) {
    console.error(sym.err((err as Error).message));
    return 1;
  }

  let pagesToDeploy = manifest.pages;
  if (pageFilter.length > 0) {
    pagesToDeploy = manifest.pages.filter((p) => {
      const page = p as Record<string, unknown>;
      return pageFilter.some(
        (f) => page['path'] === f || page['resolver_kind'] === f,
      );
    });
    if (pagesToDeploy.length === 0) {
      const available = manifest.pages
        .map((p) => {
          const page = p as Record<string, unknown>;
          return page['path'] ?? page['resolver_kind'];
        })
        .join(', ');
      console.error(sym.err(`No pages matched filter: ${pc.cyan(pageFilter.join(', '))}`));
      console.error(sym.hint(`Available: ${available}`));
      return 1;
    }
    const matched = pagesToDeploy
      .map((p) => {
        const page = p as Record<string, unknown>;
        return page['path'] ?? page['resolver_kind'];
      })
      .join(', ');
    console.log(`Deploying ${pc.bold(String(pagesToDeploy.length))} page(s): ${pc.cyan(matched)}\n`);
  }

  if (dryRun) {
    console.log(pc.dim('Dry run — no API call made.\n'));
    console.log(pc.bold('Payload:'));
    console.log(JSON.stringify({
      website_domain: domain,
      section_types: manifest.section_types,
      pages: pagesToDeploy,
      shell_sections: manifest.shell_sections ?? [],
    }, null, 2));
    return 0;
  }

  if (!skipPrompt) {
    console.log(`\nDeploy to: ${pc.bold(pc.cyan(domain))}`);
    console.log(pc.dim(`  ${manifest.section_types.length} section type(s)  ·  ${pagesToDeploy.length} page(s)\n`));
    const confirmed = await promptYesNo('Continue?', true);
    if (!confirmed) {
      console.log('Aborted.');
      return 0;
    }
    console.log();
  }

  let client: WebsiteDeployClient;
  try {
    client = new WebsiteDeployClient({ apiUrl, serviceKey });
  } catch (err: unknown) {
    console.error(sym.err((err as Error).message));
    return 1;
  }

  const start = Date.now();
  const spinner = createSpinner(`Deploying to ${pc.cyan(domain)}`);

  const doDeploy = (withForce: boolean) =>
    client.deploy(domain, { ...manifest, pages: pagesToDeploy }, { force: withForce });

  try {
    const result = await doDeploy(force).catch(async (err: unknown) => {
      if (
        err instanceof WebsiteDeployClientError &&
        err.status === 409 &&
        err.breakingChanges?.length
      ) {
        spinner.stop();
        console.error(`\n${sym.warn('Breaking changes detected:')}\n`);
        for (const bc of err.breakingChanges) {
          console.error(`  ${pc.dim('Section type :')} ${pc.cyan(bc.section_type)}`);
          console.error(`  ${pc.dim('Attribute    :')} ${bc.attribute}`);
          console.error(`  ${pc.dim('Change       :')} ${bc.change} ${pc.dim('from')} ${pc.yellow(`'${bc.from}'`)} ${pc.dim('to')} ${pc.yellow(`'${bc.to}'`)}\n`);
        }
        console.error(sym.hint('Note: existing attribute content may be incompatible with the new type.\n'));

        const applyForce = await promptYesNo('Apply breaking changes anyway?', false);
        if (!applyForce) {
          console.log(`Aborted. Re-run with ${pc.yellow('--force')} to apply breaking changes non-interactively.`);
          throw Object.assign(new Error('user_abort'), { handled: true });
        }

        spinner.update(`Deploying with ${pc.yellow('--force')} to ${pc.cyan(domain)}`);
        return doDeploy(true);
      }
      throw err;
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    spinner.succeed(`Connected to ${pc.cyan(result.website.domain)} ${pc.dim(`(website #${result.website.id})`)}`);

    console.log(`\n${pc.bold('Section types')}`);
    for (const key of result.section_types.created)   console.log(sym.created(key));
    for (const key of result.section_types.updated)   console.log(sym.updated(key));
    if (result.section_types.unchanged.length) {
      console.log(sym.unchanged(result.section_types.unchanged.join(', ')));
    }

    console.log(`\n${pc.bold('Pages')}`);
    for (const pageId of result.pages.created) {
      const scaffolded = result.pages.scaffolded[pageId];
      if (scaffolded?.length) {
        console.log(sym.created(pageId, `  ${pc.cyan('→')}  scaffolded ${pc.dim(`[${scaffolded.join(', ')}]`)}`));
      } else {
        console.log(sym.created(pageId));
      }
    }
    for (const [pageId, reason] of Object.entries(result.pages.skipped)) {
      console.log(sym.skipped(pageId, reason));
    }

    if (result.warnings.length) {
      console.log(`\n${pc.yellow('⚠ Warnings')}`);
      for (const warning of result.warnings) console.log(sym.bullet(warning));
    }

    console.log(`\n${sym.ok(`Deploy completed in ${pc.dim(elapsed + 's')}`)} `);
    return 0;

  } catch (err: unknown) {
    if (err instanceof Error && (err as Error & { handled?: boolean }).handled) {
      return 0;
    }
    spinner.fail('Deploy failed');

    if (err instanceof WebsiteDeployClientError) {
      if (err.status === 404) {
        console.error(sym.err(`Website ${pc.cyan(`'${domain}'`)} not found.`));
        console.error(sym.hint('Verify PROXIMA_DOMAIN matches a website configured in the Proxima admin.'));
        return 1;
      }
      if (err.status === 403) {
        console.error(sym.err('Access denied. The service key does not have access to this website.'));
        return 1;
      }
      console.error(sym.err(`Deploy failed ${pc.dim(`(${err.status ?? 'network error'})`)}: ${err.message}`));
      if (err.responseText) console.error(sym.hint(err.responseText));
      return 1;
    }
    console.error(sym.err(`Unexpected error: ${(err as Error).message}`));
    return 1;
  }
}
