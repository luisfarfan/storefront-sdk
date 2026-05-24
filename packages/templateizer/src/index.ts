#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TemplateRegistryClient, WebsiteDeployClient, WebsiteDeployClientError, type WebsiteTemplateRecord } from "@proxima-io/template-registry-client";
import { parseTemplateManifest, validateTemplateManifest, validateWebsiteDeployManifest, type TemplateManifest, type WebsiteDeployManifest } from "@proxima-io/template-schema";

type JsonRecord = Record<string, unknown>;

const commands = new Set([
  "scan",
  "snapshot",
  "analyze",
  "infer-schema",
  "infer-collections",
  "codemod",
  "validate",
  "preview",
  "register",
  "deploy",
  "publish",
  "sync",
  "status",
  "website-deploy",
]);

export async function run(argv = process.argv.slice(2)): Promise<number> {
  if (argv[0] === "--") {
    argv = argv.slice(1);
  }
  const [command, target = "."] = argv;
  if (!command || !commands.has(command)) {
    printHelp();
    return command ? 1 : 0;
  }

  const cwd = process.cwd();
  const targetPath = path.resolve(cwd, target);

  if (command === "validate") {
    return validateTarget(targetPath);
  }
  if (command === "publish") {
    return publishTemplateCommand(targetPath, argv.slice(2));
  }
  if (command === "register") {
    return registerTemplateCommand(targetPath, argv.slice(2));
  }
  if (command === "deploy") {
    return deployTemplateCommand(targetPath, argv.slice(2));
  }
  if (command === "sync") {
    return syncTemplateCommand(targetPath, argv.slice(2));
  }
  if (command === "status") {
    return statusTemplateCommand(targetPath, argv.slice(2));
  }
  if (command === "website-deploy") {
    return websiteDeployCommand(targetPath, argv.slice(2));
  }
  if (command === "preview") {
    console.log("Run preview with: pnpm --filter @proxima-io/catalog-preview dev");
    console.log(`Template target: ${targetPath}`);
    return 0;
  }

  const artifacts = buildArtifacts(targetPath, command);
  writeArtifacts(targetPath, artifacts);
  console.log(`Templateizer ${command} complete. Artifacts written to ${artifactDir(targetPath)}`);
  return 0;
}

export function buildArtifacts(targetPath: string, command: string) {
  const pages = discoverPages(targetPath);
  const componentFiles = findFiles(path.join(targetPath, "src"), [".astro", ".tsx", ".ts"]).filter(
    (file) => !file.includes(`${path.sep}pages${path.sep}`),
  );
  const manifestPath = findManifestPath(targetPath);
  const manifest = manifestPath ? readJson(manifestPath) : null;

  return {
    "pages.json": pages,
    "sections.json": inferSections(manifest),
    "attributes.json": inferAttributes(manifest),
    "smart-collections.json": inferSmartCollections(manifest),
    "manifest.generated.json": manifest ?? {},
    "report.md": buildReport({ command, targetPath, pages, componentFiles, manifestPath }),
  };
}

export function validateTarget(targetPath: string): number {
  const manifests = collectManifestPaths(targetPath);
  if (!manifests.length) {
    console.error(`No proxima.template.json files found under ${targetPath}`);
    return 1;
  }

  let failed = false;
  for (const manifestPath of manifests) {
    const value = readJson(manifestPath);
    const result = validateTemplateManifest(value);
    if (!result.success) {
      failed = true;
      console.error(`Invalid manifest: ${manifestPath}`);
      for (const issue of result.error.issues) {
        console.error(`- ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
    } else {
      console.log(`Valid manifest: ${manifestPath}`);
    }
  }
  return failed ? 1 : 0;
}

function writeArtifacts(targetPath: string, artifacts: Record<string, unknown>) {
  const outputDir = artifactDir(targetPath);
  mkdirSync(outputDir, { recursive: true });
  for (const [filename, value] of Object.entries(artifacts)) {
    const fullPath = path.join(outputDir, filename);
    const payload = filename.endsWith(".md") ? String(value) : `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(fullPath, payload);
  }
}

function artifactDir(targetPath: string) {
  return path.join(targetPath, ".proxima", "templateizer");
}

function collectManifestPaths(targetPath: string): string[] {
  if (statSync(targetPath).isFile()) {
    return path.basename(targetPath) === "proxima.template.json" ? [targetPath] : [];
  }
  return findFiles(targetPath, [".json"]).filter((file) => path.basename(file) === "proxima.template.json");
}

function findManifestPath(targetPath: string): string | null {
  const direct = path.join(targetPath, "proxima.template.json");
  if (existsSync(direct)) {
    return direct;
  }
  const matches = collectManifestPaths(targetPath);
  return matches[0] ?? null;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function discoverPages(targetPath: string) {
  const pagesDir = path.join(targetPath, "src", "pages");
  if (!existsSync(pagesDir)) {
    return [];
  }
  return findFiles(pagesDir, [".astro", ".tsx", ".ts"]).map((file) => ({
    file: path.relative(targetPath, file),
    path: routeFromPageFile(path.relative(pagesDir, file)),
  }));
}

function routeFromPageFile(relativeFile: string) {
  const withoutExt = relativeFile.replace(/\.(astro|tsx|ts)$/u, "");
  const normalized = withoutExt
    .replace(/(^|\/)index$/u, "$1")
    .replace(/\[\.{3}(.+?)\]/gu, "{$1*}")
    .replace(/\[(.+?)\]/gu, "{$1}");
  const route = `/${normalized}`.replace(/\/+/gu, "/").replace(/\/$/u, "");
  return route || "/";
}

function findFiles(root: string, extensions: string[]): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const results: string[] = [];
  for (const item of readdirSync(root)) {
    if (item === "node_modules" || item === "dist" || item === ".astro" || item === ".proxima") {
      continue;
    }
    const fullPath = path.join(root, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findFiles(fullPath, extensions));
    } else if (extensions.some((extension) => fullPath.endsWith(extension))) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function inferSections(manifest: unknown) {
  const parsed = safeManifest(manifest);
  return parsed?.pages.flatMap((page) => page.sections.map((section) => ({ page: page.path, ...section }))) ?? [];
}

function inferAttributes(manifest: unknown) {
  const parsed = safeManifest(manifest);
  return parsed?.section_types.map((sectionType) => ({
    section_type: sectionType.key,
    attributes: sectionType.attribute_schema,
  })) ?? [];
}

function inferSmartCollections(manifest: unknown) {
  const parsed = safeManifest(manifest);
  return parsed?.smart_collection_placeholders ?? [];
}

function safeManifest(manifest: unknown): TemplateManifest | null {
  if (!manifest) {
    return null;
  }
  try {
    return parseTemplateManifest(manifest);
  } catch {
    return null;
  }
}

function buildReport(input: {
  command: string;
  targetPath: string;
  pages: Array<JsonRecord>;
  componentFiles: string[];
  manifestPath: string | null;
}) {
  return [
    `# Templateizer Report`,
    ``,
    `- Command: ${input.command}`,
    `- Target: ${input.targetPath}`,
    `- Manifest: ${input.manifestPath ?? "not found"}`,
    `- Pages detected: ${input.pages.length}`,
    `- Component/source files detected: ${input.componentFiles.length}`,
    ``,
    `## Pages`,
    ``,
    ...input.pages.map((page) => `- ${page.path}: ${page.file}`),
    ``,
  ].join("\n");
}

async function registerTemplateCommand(targetPath: string, argv: string[]) {
  const manifest = loadManifest(targetPath);
  const payload = toApiTemplatePayload(manifest, { publicationStatus: "draft" });
  const dryRun = argv.includes("--dry-run");
  if (dryRun) {
    console.log(JSON.stringify({ action: "register", lookup: lookupPayload(manifest), payload }, null, 2));
    return 0;
  }

  const client = makeRegistryClient(argv);
  const existing = await client.findTemplate(lookupPayload(manifest));
  const template = existing
    ? await client.updateTemplate(existing.id, payload)
    : await client.createTemplate(payload);
  writeRegistryState(targetPath, manifest, template, payload);
  console.log(JSON.stringify({ action: existing ? "updated" : "created", template_id: template.id, publication_status: template.publication_status }, null, 2));
  return 0;
}

async function deployTemplateCommand(targetPath: string, argv: string[]) {
  const manifest = loadManifest(targetPath);
  const deploymentConfig = buildDeploymentConfig(manifest, argv);
  const dryRun = argv.includes("--dry-run");
  if (dryRun) {
    console.log(JSON.stringify({ action: "deploy", lookup: lookupPayload(manifest), deployment_config: deploymentConfig }, null, 2));
    return 0;
  }

  const client = makeRegistryClient(argv);
  const existing = await requireRegisteredTemplate(client, manifest);
  const template = await client.patchDeployment(existing.id, deploymentConfig);
  writeRegistryState(targetPath, manifest, template, { deployment_config: deploymentConfig });
  console.log(JSON.stringify({ action: "deployment_updated", template_id: template.id, deployment_config: template.deployment_config }, null, 2));
  return 0;
}

async function publishTemplateCommand(targetPath: string, argv: string[]) {
  const manifest = loadManifest(targetPath);
  if (argv.includes("--dry-run")) {
    console.log(JSON.stringify({ action: "publish", lookup: lookupPayload(manifest), patch: { publication_status: "published" } }, null, 2));
    return 0;
  }

  const client = makeRegistryClient(argv);
  const existing = await requireRegisteredTemplate(client, manifest);
  const template = await client.publishTemplate(existing.id);
  writeRegistryState(targetPath, manifest, template, { publication_status: "published" });
  console.log(JSON.stringify({ action: "published", template_id: template.id, publication_status: template.publication_status }, null, 2));
  return 0;
}

async function syncTemplateCommand(targetPath: string, argv: string[]) {
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
  if (argv.includes("--publish")) {
    return publishTemplateCommand(targetPath, argv);
  }
  return 0;
}

async function statusTemplateCommand(targetPath: string, argv: string[]) {
  const manifest = loadManifest(targetPath);
  const dryRun = argv.includes("--dry-run");
  if (dryRun) {
    console.log(JSON.stringify({ action: "status", lookup: lookupPayload(manifest) }, null, 2));
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


function loadManifest(targetPath: string) {
  const manifestPath = findManifestPath(targetPath);
  if (!manifestPath) {
    throw new Error(`No proxima.template.json found under ${targetPath}`);
  }

  return parseTemplateManifest(readJson(manifestPath));
}

function makeRegistryClient(argv: string[]) {
  const apiUrl = readFlag(argv, "--api-url") ?? process.env.PROXIMA_API_URL;
  const token = readFlag(argv, "--token") ?? process.env.PROXIMA_API_TOKEN;
  return new TemplateRegistryClient({ apiUrl, token });
}

function lookupPayload(manifest: TemplateManifest) {
  return { templateKey: manifest.template_key, slug: manifest.slug };
}

async function requireRegisteredTemplate(client: TemplateRegistryClient, manifest: TemplateManifest) {
  const existing = await client.findTemplate(lookupPayload(manifest));
  if (!existing) {
    throw new Error(`Template '${manifest.template_key}' is not registered. Run register first.`);
  }
  return existing;
}

function toApiTemplatePayload(manifest: TemplateManifest, options: { publicationStatus?: string } = {}) {
  return {
    name: manifest.name,
    description: manifest.description,
    slug: manifest.slug,
    category: manifest.category,
    industry: manifest.industry,
    tags: manifest.tags,
    preview_image: manifest.preview_image,
    preview_images: manifest.preview_images,
    publication_status: options.publicationStatus ?? "draft",
    delivery_mode: manifest.deployment_config.runtime_kind === "external" ? "external_repository" : "managed_template",
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

function buildDeploymentConfig(manifest: TemplateManifest, argv: string[]) {
  const config: Record<string, unknown> = { ...manifest.deployment_config };
  setFlagValue(config, "preview_url", readFlag(argv, "--preview-url"));
  setFlagValue(config, "production_url", readFlag(argv, "--production-url"));
  setFlagValue(config, "build_id", readFlag(argv, "--build-id"));
  setFlagValue(config, "artifact_url", readFlag(argv, "--artifact-url"));
  setFlagValue(config, "status", readFlag(argv, "--status"));
  return config;
}

function setFlagValue(target: Record<string, unknown>, key: string, value: string | undefined) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function hasDeploymentFlags(argv: string[]) {
  return ["--preview-url", "--production-url", "--build-id", "--artifact-url", "--status"].some((flag) => argv.includes(flag));
}

function writeRegistryState(targetPath: string, manifest: TemplateManifest, template: WebsiteTemplateRecord, payload: unknown) {
  const dir = path.join(targetPath, ".proxima", "registry");
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

function hashPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function readFlag(argv: string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

// ---------------------------------------------------------------------------
// website-deploy command
// ---------------------------------------------------------------------------

/**
 * Reads a .env file from the given directory and returns key=value pairs.
 * Values already in process.env take precedence (allows CI overrides).
 */
function loadDotEnv(targetPath: string): Record<string, string> {
  const envPath = path.join(targetPath, ".env");
  const result: Record<string, string> = {};
  if (!existsSync(envPath)) return result;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes if present
    const value = raw.replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

function resolveEnvVar(key: string, dotenv: Record<string, string>): string | undefined {
  // process.env takes precedence over .env file
  return process.env[key] ?? dotenv[key];
}

function findWebsiteManifestPath(targetPath: string): string | null {
  const websiteManifest = path.join(targetPath, "proxima.website.json");
  if (existsSync(websiteManifest)) return websiteManifest;

  // Fallback: warn if only proxima.template.json exists
  const templateManifest = path.join(targetPath, "proxima.template.json");
  if (existsSync(templateManifest)) {
    console.warn(
      "⚠  proxima.website.json not found. Falling back to proxima.template.json\n" +
      "   Consider creating proxima.website.json for the website-deploy command.",
    );
    return templateManifest;
  }
  return null;
}

function loadWebsiteManifest(targetPath: string): WebsiteDeployManifest {
  const manifestPath = findWebsiteManifestPath(targetPath);
  if (!manifestPath) {
    throw new Error(
      "proxima.website.json not found. Run from your storefront project root.",
    );
  }

  const raw = readJson(manifestPath);
  const result = validateWebsiteDeployManifest(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid manifest at ${manifestPath}:\n${issues}`);
  }
  return result.data;
}

async function websiteDeployCommand(targetPath: string, argv: string[]): Promise<number> {
  const dotenv = loadDotEnv(targetPath);

  const apiUrl     = readFlag(argv, "--api-url")     ?? resolveEnvVar("PROXIMA_API_URL", dotenv);
  const serviceKey = readFlag(argv, "--service-key") ?? resolveEnvVar("PROXIMA_SERVICE_KEY", dotenv);
  const domain     =
    readFlag(argv, "--domain") ??
    resolveEnvVar("PROXIMA_DOMAIN", dotenv) ??
    resolveEnvVar("PROXIMA_WEBSITE_DOMAIN", dotenv);
  const dryRun     = argv.includes("--dry-run");
  const force      = argv.includes("--force");

  // Validate credentials up front
  if (!apiUrl) {
    console.error("✗ PROXIMA_API_URL is required (set in .env or pass --api-url)");
    return 1;
  }
  if (!serviceKey) {
    console.error("✗ PROXIMA_SERVICE_KEY is required (set in .env or pass --service-key)");
    return 1;
  }
  if (!domain) {
    console.error("✗ PROXIMA_DOMAIN is required (set in .env or pass --domain)");
    return 1;
  }

  // Load and validate manifest
  let manifest: WebsiteDeployManifest;
  try {
    manifest = loadWebsiteManifest(targetPath);
  } catch (err: unknown) {
    console.error(`✗ ${(err as Error).message}`);
    return 1;
  }

  // Dry run — print payload and exit
  if (dryRun) {
    console.log("Dry run — no API call made.\n");
    console.log("Payload:");
    console.log(JSON.stringify({
      website_domain: domain,
      section_types: manifest.section_types,
      pages: manifest.pages,
      shell_sections: manifest.shell_sections ?? [],
    }, null, 2));
    return 0;
  }

  // Deploy
  const start = Date.now();
  let client: WebsiteDeployClient;
  try {
    client = new WebsiteDeployClient({ apiUrl, serviceKey });
  } catch (err: unknown) {
    console.error(`✗ ${(err as Error).message}`);
    return 1;
  }

  try {
    const result = await client.deploy(domain, manifest, { force });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`✓ Connected to ${result.website.domain} (website #${result.website.id})\n`);

    // Section types summary
    console.log("Section types");
    for (const key of result.section_types.created)   console.log(`  + created    ${key}`);
    for (const key of result.section_types.updated)   console.log(`  ~ updated    ${key}`);
    if (result.section_types.unchanged.length) {
      console.log(`  · unchanged  ${result.section_types.unchanged.join(", ")}`);
    }

    // Pages summary
    console.log("\nPages");
    for (const pageId of result.pages.created) {
      const scaffolded = result.pages.scaffolded[pageId];
      const scaffoldStr = scaffolded?.length ? `  →  scaffolded [${scaffolded.join(", ")}]` : "";
      console.log(`  + created    ${pageId}${scaffoldStr}`);
    }
    for (const [pageId, reason] of Object.entries(result.pages.skipped)) {
      console.log(`  · skipped    ${pageId}  (${reason})`);
    }

    // Warnings
    if (result.warnings.length) {
      console.log("\n⚠ Warnings");
      for (const warning of result.warnings) console.log(`  · ${warning}`);
    }

    console.log(`\n✓ Deploy completed in ${elapsed}s`);
    return 0;
  } catch (err: unknown) {
    if (err instanceof WebsiteDeployClientError) {
      if (err.status === 409 && err.breakingChanges?.length) {
        console.error("✗ Deploy blocked — breaking changes detected:\n");
        for (const bc of err.breakingChanges) {
          console.error(`  Section type: ${bc.section_type}`);
          console.error(`  Attribute:    ${bc.attribute}`);
          console.error(`  Change:       ${bc.change} from '${bc.from}' to '${bc.to}'\n`);
        }
        console.error("Re-run with --force to apply these changes.");
        console.error("Note: existing attribute content may be incompatible with the new type.");
        return 1;
      }
      if (err.status === 404) {
        console.error(`✗ Website '${domain}' not found.`);
        console.error("  Verify PROXIMA_DOMAIN matches a website configured in the Proxima admin.");
        return 1;
      }
      if (err.status === 403) {
        console.error("✗ Access denied. The service key does not have access to this website.");
        return 1;
      }
      console.error(`✗ Deploy failed (${err.status ?? "network error"}): ${err.message}`);
      if (err.responseText) console.error(`  ${err.responseText}`);
      return 1;
    }
    console.error(`✗ Unexpected error: ${(err as Error).message}`);
    return 1;
  }
}

function printHelp() {
  console.log(`Usage: proxima-templateizer <command> <target>

Commands:
  scan              Detect pages and source files.
  snapshot          Create auditable snapshot artifacts.
  analyze           Infer pages, sections, attributes, collections.
  infer-schema      Emit attribute schema artifacts from manifest.
  infer-collections Emit Smart Collection placeholder artifacts.
  codemod           Prepare codemod audit artifacts.
  validate          Validate one template or template tree.
  preview           Print local preview instructions.
  register          Create or update a draft WebsiteTemplate in proxima-api.
  deploy            Patch deployment_config for a registered template.
  publish           Mark a registered template as published.
  sync              Validate, register, optionally deploy metadata, optionally publish.
  status            Show admin registry state and storefront visibility.
  website-deploy    Deploy section types + page scaffolding to a specific website.

Website deploy options:
  --dry-run         Print the payload without calling the API.
  --force           Allow breaking changes (attribute type changes, renames).
  --domain          Override PROXIMA_DOMAIN.
  --service-key     Override PROXIMA_SERVICE_KEY.
  --api-url         Override PROXIMA_API_URL.

Template registry options:
  --dry-run         Print planned action without calling the API.
  --api-url         Override PROXIMA_API_URL.
  --token           Override PROXIMA_API_TOKEN.
  --publish         Publish during sync.
`);
}

function isCliEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fileURLToPath(import.meta.url) === path.resolve(entry);
  } catch {
    return false;
  }
}

if (isCliEntrypoint()) {
  run().then((code) => {
    process.exitCode = code;
  });
}
