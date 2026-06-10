import pc from 'picocolors';
import { sym } from '../ui/sym.js';

export function printHelp(unknownCommand?: string) {
  if (unknownCommand) {
    console.error(`${sym.err(`Unknown command: ${pc.bold(unknownCommand)}`)}\n`);
  }

  const b  = (s: string) => pc.bold(s);
  const c  = (s: string) => pc.cyan(s);
  const y  = (s: string) => pc.yellow(s);
  const d  = (s: string) => pc.dim(s);

  console.log(`
${b("Usage:")} ${c("proxima-templateizer")} <command> [target] [options]

${b("SETUP")}
  ${c("init")}              Interactive setup wizard — creates ${d(".proxima/credentials.json")}
                    and adds it to .gitignore. Use instead of managing .env manually.

${b("WEBSITE DEPLOY")}
  ${c("website-deploy")}    Deploy section types + page scaffolding to a specific website.

    ${d("Options:")}
      ${y("--dry-run")}                  Print the payload without calling the API.
      ${y("--force")}                    Apply breaking changes without prompting.
      ${y("--yes")}, ${y("-y")}                  Skip the pre-deploy confirmation prompt (useful in CI).
      ${y("--page")} <path>              Deploy only this page (repeatable: ${d("--page /a --page /b")}).
                                 Matches against page path or resolver_kind.
      ${y("--domain")} <domain>          Override PROXIMA_DOMAIN.
      ${y("--service-key")} <k>          Override PROXIMA_SERVICE_KEY.
      ${y("--api-url")} <url>            Override PROXIMA_API_URL.
      ${y("--credentials")} <file.json>  Path to a credentials JSON file.

    ${d("Credentials (highest → lowest priority):")}
      ${d("CLI flags  >  process.env  >  --credentials / .proxima/credentials.json  >  .env")}

${b("TEMPLATE COMMANDS")}
  ${c("validate")}          Validate one template or template tree ${d("(proxima.template.json)")}.
  ${c("register")}          Create or update a draft WebsiteTemplate in proxima-api.
  ${c("deploy")}            Patch deployment_config for a registered template.
  ${c("publish")}           Mark a registered template as published.
  ${c("sync")}              validate → register → [deploy] → [publish].
  ${c("status")}            Show admin registry state and storefront visibility.

    ${d("Options (register / deploy / publish / sync / status):")}
      ${y("--dry-run")}         Print planned action without calling the API.
      ${y("--api-url")} <url>   Override PROXIMA_API_URL.
      ${y("--token")} <token>   Override PROXIMA_API_TOKEN.
      ${y("--publish")}         Also publish during sync.

  ${c("template-deploy")}   ${d("[LEGACY]")} Push inline structure to the template DB column.
  ${c("template-create")}   Idempotent create-or-update of a template row in the API.

    ${d("Options:")}
      ${y("--dry-run")}             Print planned payload without calling the API.
      ${y("--publish-manifest")}    Upload structure to S3 and PATCH the manifest pointer.
      ${y("--local-only")}          Skip S3 upload ${d("(API reads from TEMPLATES_LOCAL_FALLBACK_DIR)")}.
      ${y("--s3-bucket")} <bucket>  Override S3_TEMPLATES_BUCKET.
      ${y("--s3-region")} <region>  Override S3_TEMPLATES_REGION ${d("(defaults to AWS_REGION)")}.
      ${y("--template-key")} <k>    Override PROXIMA_TEMPLATE_KEY.
      ${y("--service-key")} <k>     Override PROXIMA_SERVICE_KEY.
      ${y("--api-url")} <url>       Override PROXIMA_API_URL.
      ${y("--name")} <string>       Template display name.
      ${y("--description")} <str>   Short description shown in the marketplace.
      ${y("--category")} <str>      Category ${d("(default: ecommerce)")}.
      ${y("--pricing-tier")} <str>  Pricing tier: ${d("free | pro")}  ${d("(default: free)")}.
      ${y("--demo-url")} <url>      Live demo URL.
      ${y("--preview-image")} <url> Hero preview image URL.
      ${y("--tags")} <a,b,c>        Comma-separated tags.

  ${c("template-publish")}  Alias for ${d("template-create --publish-manifest")} ${d("(backward compat)")}.

${b("ARTIFACT GENERATION")} ${d("(no API calls)")}
  ${c("scan")}              Detect pages and source files.
  ${c("snapshot")}          Create auditable snapshot artifacts.
  ${c("analyze")}           Infer pages, sections, attributes, collections.
  ${c("infer-schema")}      Emit attribute schema artifacts from manifest.
  ${c("infer-collections")} Emit Smart Collection placeholder artifacts.
  ${c("codemod")}           Prepare codemod audit artifacts.
  ${c("preview")}           Print local preview instructions.

${b("CREDENTIALS FILE")}
  ${d(".proxima/credentials.json")} (or ${d("proxima-credentials.json")} at project root):

  ${d(`{
    "api_url":      "https://api.proxima.io",
    "service_key":  "pxa_live_...",
    "domain":       "mystore.proxima.app",
    "template_key": "my-template"   // optional
  }`)}

  Run ${c("proxima-templateizer init")} to create this file interactively.
  Never commit it — init adds it to .gitignore automatically.

${b("ENV VARS")} ${d("(alternative to credentials file)")}
  ${y("PROXIMA_API_URL")}        API base URL
  ${y("PROXIMA_SERVICE_KEY")}    Bearer token ${d("(cms:websites:write scope)")}
  ${y("PROXIMA_DOMAIN")}         Website domain
  ${y("PROXIMA_TEMPLATE_KEY")}   Template key ${d("(template commands only)")}
  ${y("PROXIMA_API_TOKEN")}      Token for template registry commands
  ${y("S3_TEMPLATES_BUCKET")}    S3 bucket for manifest uploads
  ${y("S3_TEMPLATES_REGION")}    S3 region ${d("(defaults to AWS_REGION)")}

  ${d("Set NO_INTERACTIVE=1 (or CI=1) to disable all interactive prompts.")}
`);
}

