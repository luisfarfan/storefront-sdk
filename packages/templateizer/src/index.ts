#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TemplateRegistryClient, WebsiteDeployClient, WebsiteDeployClientError, type WebsiteTemplateRecord } from "@proxima-io/template-registry-client";
import { parseTemplateManifest, validateTemplateManifest, validateWebsiteDeployManifest, type TemplateManifest, type WebsiteDeployManifest } from "@proxima-io/template-schema";

type JsonRecord = Record<string, unknown>;

const commands = new Set([
  "init",
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
  "template-deploy",
  "template-create",
  "template-publish",
]);

// ─── CI / TTY detection ───────────────────────────────────────────────────────
// Skip interactive prompts when running in CI or when stdin is not a terminal.

const isCI = Boolean(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.NO_INTERACTIVE ||
  !process.stdin.isTTY,
);

// ─── Credentials JSON support ─────────────────────────────────────────────────
//
// The CLI can read credentials from a JSON file instead of (or in addition to)
// environment variables. The file is looked up in this order:
//
//   1. .proxima/credentials.json  (recommended — co-located with .proxima/ artifacts)
//   2. proxima-credentials.json   (project root fallback)
//
// Resolution priority (highest → lowest):
//   CLI flag > process.env > credentials JSON > .env file
//
// Add .proxima/credentials.json to .gitignore — `init` does this automatically.

interface ProximaCredentials {
  api_url?: string;
  service_key?: string;
  domain?: string;
  template_key?: string;
  api_token?: string;
  s3_bucket?: string;
  s3_region?: string;
}

function findCredentialsPath(targetPath: string, explicitPath?: string): string | null {
  if (explicitPath) {
    const resolved = path.resolve(process.cwd(), explicitPath);
    if (!existsSync(resolved)) {
      console.error(`✗ Credentials file not found: ${resolved}`);
      process.exit(1);
    }
    return resolved;
  }
  const candidates = [
    path.join(targetPath, ".proxima", "credentials.json"),
    path.join(targetPath, "proxima-credentials.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function loadCredentials(targetPath: string, explicitPath?: string): ProximaCredentials {
  const credPath = findCredentialsPath(targetPath, explicitPath);
  if (!credPath) return {};
  try {
    return readJson(credPath) as ProximaCredentials;
  } catch (err: unknown) {
    console.error(`✗ Failed to read credentials file ${credPath}: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Unified variable resolution:
 *   CLI flag  >  process.env  >  credentials JSON  >  .env file  >  .env aliases
 */
function resolveVar(
  flagValue: string | undefined,
  envKey: string,
  credValue: string | undefined,
  dotenv: Record<string, string>,
  ...dotenvAliases: string[]
): string | undefined {
  return (
    flagValue ??
    process.env[envKey] ??
    credValue ??
    dotenv[envKey] ??
    dotenvAliases.reduce<string | undefined>((v, k) => v ?? dotenv[k], undefined)
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
//
// Spinner output goes to stderr so it never pollutes stdout (JSON / dry-run
// payloads go to stdout). On non-TTY/CI runs it degrades to plain log lines.

interface Spinner {
  update(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

function createSpinner(text: string): Spinner {
  const isTTY = process.stderr.isTTY;
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let current = text;

  if (!isTTY) {
    process.stderr.write(`  ${text}...\n`);
    return {
      update: (t) => { current = t; process.stderr.write(`  ${t}...\n`); },
      succeed: (t) => process.stderr.write(`✓ ${t}\n`),
      fail:    (t) => process.stderr.write(`✗ ${t}\n`),
      stop:    () => {},
    };
  }

  const interval = setInterval(() => {
    process.stderr.write(`\r${frames[i % frames.length]} ${current}   `);
    i++;
  }, 80);

  const clear = () => {
    clearInterval(interval);
    process.stderr.write(`\r${" ".repeat(current.length + 6)}\r`);
  };

  return {
    update: (t) => { current = t; },
    succeed: (t) => { clear(); process.stderr.write(`✓ ${t}\n`); },
    fail:    (t) => { clear(); process.stderr.write(`✗ ${t}\n`); },
    stop:    () => { clear(); },
  };
}

// ─── Interactive prompts ──────────────────────────────────────────────────────
//
// All prompt functions are no-ops in CI / non-TTY environments, returning the
// supplied default value so automated pipelines continue to work unchanged.

async function promptText(question: string, defaultValue?: string): Promise<string> {
  if (isCI) return defaultValue ?? "";
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    const hint = defaultValue ? ` (${defaultValue})` : "";
    rl.question(`  ${question}${hint} › `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

async function promptHidden(question: string): Promise<string> {
  if (isCI) return "";
  const { createInterface } = await import("node:readline");
  return new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(`  ${question} › `);
    // Mute echoed characters by swallowing write calls while readline reads.
    type WriteFn = typeof process.stdout.write;
    const origWrite = process.stdout.write.bind(process.stdout) as WriteFn;
    (process.stdout as unknown as { write: WriteFn }).write = () => true;
    rl.question("", (answer) => {
      (process.stdout as unknown as { write: WriteFn }).write = origWrite;
      process.stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  if (isCI) return defaultYes;
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    const hint = defaultYes ? "Y/n" : "y/N";
    rl.question(`  ${question} (${hint}) › `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a ? a === "y" || a === "yes" : defaultYes);
    });
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function run(argv = process.argv.slice(2)): Promise<number> {
  if (argv[0] === "--") {
    argv = argv.slice(1);
  }
  const [command, target = "."] = argv;
  if (!command || !commands.has(command)) {
    printHelp(command);
    return command ? 1 : 0;
  }

  const cwd = process.cwd();
  const targetPath = path.resolve(cwd, target);

  if (command === "init") {
    return initCommand(targetPath);
  }
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
  if (command === "template-deploy") {
    return templateDeployCommand(targetPath, argv.slice(2));
  }
  if (command === "template-create") {
    return templateCreateCommand(targetPath, argv.slice(2));
  }
  if (command === "template-publish") {
    return templatePublishCommand(targetPath, argv.slice(2));
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

// ─── Init command ─────────────────────────────────────────────────────────────
//
// Interactive wizard that creates .proxima/credentials.json and adds it to
// .gitignore. Reads existing .env values as defaults so you don't have to
// re-type credentials you already have.
//
// Usage:
//   proxima-templateizer init [target]

async function initCommand(targetPath: string): Promise<number> {
  const dotenv = loadDotEnv(targetPath);

  console.log("Proxima CLI — Project Setup\n");
  console.log("Creates .proxima/credentials.json with your API credentials.");
  console.log("This file is never committed (added to .gitignore automatically).\n");

  const existingCredPath = findCredentialsPath(targetPath);
  if (existingCredPath) {
    const rel = path.relative(process.cwd(), existingCredPath);
    console.log(`  Found existing credentials: ${rel}`);
    const overwrite = await promptYesNo("Overwrite?", false);
    if (!overwrite) {
      console.log("Aborted.");
      return 0;
    }
    console.log();
  }

  // Use existing env/dotenv values as pre-filled defaults.
  const defaultApiUrl     = process.env.PROXIMA_API_URL     ?? dotenv.PROXIMA_API_URL     ?? "https://api.proxima.io";
  const defaultDomain     = process.env.PROXIMA_DOMAIN      ?? dotenv.PROXIMA_DOMAIN      ?? dotenv.PROXIMA_WEBSITE_DOMAIN ?? "";
  const defaultTemplateKey = process.env.PROXIMA_TEMPLATE_KEY ?? dotenv.PROXIMA_TEMPLATE_KEY ?? "";

  const apiUrl      = await promptText("API URL", defaultApiUrl);
  const domain      = await promptText("Website domain  (e.g. mystore.proxima.app)", defaultDomain || undefined);
  const serviceKey  = await promptHidden("Service key     (pxa_live_... or pxa_test_...)");
  const templateKey = await promptText("Template key    (optional — leave blank if not needed)", defaultTemplateKey || undefined);

  if (!domain) {
    console.error("\n✗ Domain is required.");
    return 1;
  }
  if (!serviceKey) {
    console.error("\n✗ Service key is required.");
    return 1;
  }

  const creds: ProximaCredentials = {
    api_url:     apiUrl || "https://api.proxima.io",
    domain:      domain.trim(),
    service_key: serviceKey,
  };
  if (templateKey.trim()) {
    creds.template_key = templateKey.trim();
  }

  // Write credentials file
  const credDir  = path.join(targetPath, ".proxima");
  const credPath = path.join(credDir, "credentials.json");
  mkdirSync(credDir, { recursive: true });
  writeFileSync(credPath, `${JSON.stringify(creds, null, 2)}\n`);

  // Ensure .proxima/credentials.json is in .gitignore
  const gitignorePath  = path.join(targetPath, ".gitignore");
  const gitignoreEntry = ".proxima/credentials.json";
  let gitignoreUpdated = false;
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf8");
    if (!content.split("\n").some((line) => line.trim() === gitignoreEntry)) {
      writeFileSync(gitignorePath, `${content.trimEnd()}\n${gitignoreEntry}\n`);
      gitignoreUpdated = true;
    }
  } else {
    writeFileSync(gitignorePath, `${gitignoreEntry}\n`);
    gitignoreUpdated = true;
  }

  const relCred = path.relative(process.cwd(), credPath);
  console.log(`\n✓ Credentials saved to ${relCred}`);
  if (gitignoreUpdated) {
    console.log(`✓ Added ${gitignoreEntry} to .gitignore`);
  }
  console.log("\nReady! Try:");
  console.log("  proxima-templateizer website-deploy --dry-run");
  return 0;
}

// ─── Artifact commands ────────────────────────────────────────────────────────

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
        console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
    } else {
      console.log(`✓ Valid manifest: ${manifestPath}`);
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

// ─── Template registry commands ───────────────────────────────────────────────

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

// ─── website-deploy command ───────────────────────────────────────────────────

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
    const value = raw.replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

function findWebsiteManifestPath(targetPath: string): string | null {
  const websiteManifest = path.join(targetPath, "proxima.website.json");
  if (existsSync(websiteManifest)) return websiteManifest;

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

/**
 * Reads all values for a repeatable flag (e.g. --page /a --page /b → ["/a", "/b"]).
 */
function readFlagAll(argv: string[], name: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === name) {
      results.push(argv[i + 1]);
    }
  }
  return results;
}

/**
 * Deploy section types + page scaffolding to a specific website.
 *
 * Credentials are resolved in this order (highest priority first):
 *   CLI flag  >  process.env  >  .proxima/credentials.json  >  .env
 *
 * Options:
 *   --dry-run           Print the payload without calling the API.
 *   --force             Apply breaking changes without prompting.
 *   --yes / -y          Skip the pre-deploy confirmation prompt.
 *   --page <path>       Deploy only this page (repeatable).
 *   --domain <domain>   Override PROXIMA_DOMAIN / credentials.domain.
 *   --service-key <k>   Override PROXIMA_SERVICE_KEY / credentials.service_key.
 *   --api-url <url>     Override PROXIMA_API_URL / credentials.api_url.
 */
async function websiteDeployCommand(targetPath: string, argv: string[]): Promise<number> {
  const dotenv = loadDotEnv(targetPath);
  const creds  = loadCredentials(targetPath, readFlag(argv, "--credentials"));

  const apiUrl     = resolveVar(readFlag(argv, "--api-url"),     "PROXIMA_API_URL",     creds.api_url,     dotenv);
  const serviceKey = resolveVar(readFlag(argv, "--service-key"), "PROXIMA_SERVICE_KEY", creds.service_key, dotenv);
  const domain     = resolveVar(readFlag(argv, "--domain"),      "PROXIMA_DOMAIN",      creds.domain,      dotenv, "PROXIMA_WEBSITE_DOMAIN");
  const dryRun     = argv.includes("--dry-run");
  const force      = argv.includes("--force");
  const skipPrompt = argv.includes("--yes") || argv.includes("-y") || isCI;
  const pageFilter = readFlagAll(argv, "--page");

  // Validate credentials up front with actionable error messages
  if (!apiUrl) {
    console.error("✗ PROXIMA_API_URL is required.");
    console.error("  Set it in .proxima/credentials.json or pass --api-url");
    console.error("  Run: proxima-templateizer init");
    return 1;
  }
  if (!serviceKey) {
    console.error("✗ PROXIMA_SERVICE_KEY is required.");
    console.error("  Set it in .proxima/credentials.json or pass --service-key");
    console.error("  Run: proxima-templateizer init");
    return 1;
  }
  if (!domain) {
    console.error("✗ PROXIMA_DOMAIN is required.");
    console.error("  Set it in .proxima/credentials.json or pass --domain");
    console.error("  Run: proxima-templateizer init");
    return 1;
  }

  // Load and validate manifest early — show clear errors before any API call
  let manifest: WebsiteDeployManifest;
  try {
    manifest = loadWebsiteManifest(targetPath);
  } catch (err: unknown) {
    console.error(`✗ ${(err as Error).message}`);
    return 1;
  }

  // Apply --page filter
  let pagesToDeploy = manifest.pages;
  if (pageFilter.length > 0) {
    pagesToDeploy = manifest.pages.filter((p) => {
      const page = p as Record<string, unknown>;
      return pageFilter.some(
        (f) => page["path"] === f || page["resolver_kind"] === f,
      );
    });
    if (pagesToDeploy.length === 0) {
      const available = manifest.pages
        .map((p) => {
          const page = p as Record<string, unknown>;
          return page["path"] ?? page["resolver_kind"];
        })
        .join(", ");
      console.error(`✗ No pages matched filter: ${pageFilter.join(", ")}`);
      console.error(`  Available: ${available}`);
      return 1;
    }
    const matched = pagesToDeploy
      .map((p) => {
        const page = p as Record<string, unknown>;
        return page["path"] ?? page["resolver_kind"];
      })
      .join(", ");
    console.log(`Deploying ${pagesToDeploy.length} page(s): ${matched}\n`);
  }

  // Dry run — print payload and exit
  if (dryRun) {
    console.log("Dry run — no API call made.\n");
    console.log("Payload:");
    console.log(JSON.stringify({
      website_domain: domain,
      section_types: manifest.section_types,
      pages: pagesToDeploy,
      shell_sections: manifest.shell_sections ?? [],
    }, null, 2));
    return 0;
  }

  // Pre-deploy summary + confirmation (skip with --yes, -y, or in CI)
  if (!skipPrompt) {
    console.log(`Deploy to: ${domain}`);
    console.log(`  ${manifest.section_types.length} section type(s)  ·  ${pagesToDeploy.length} page(s)\n`);
    const confirmed = await promptYesNo("Continue?", true);
    if (!confirmed) {
      console.log("Aborted.");
      return 0;
    }
    console.log();
  }

  let client: WebsiteDeployClient;
  try {
    client = new WebsiteDeployClient({ apiUrl, serviceKey });
  } catch (err: unknown) {
    console.error(`✗ ${(err as Error).message}`);
    return 1;
  }

  const start = Date.now();
  const spinner = createSpinner(`Deploying to ${domain}`);

  const doDeploy = (withForce: boolean) =>
    client.deploy(domain, { ...manifest, pages: pagesToDeploy }, { force: withForce });

  try {
    // Attempt deploy; on 409 offer interactive --force instead of hard-failing
    const result = await doDeploy(force).catch(async (err: unknown) => {
      if (
        err instanceof WebsiteDeployClientError &&
        err.status === 409 &&
        err.breakingChanges?.length
      ) {
        spinner.stop();
        console.error("✗ Breaking changes detected:\n");
        for (const bc of err.breakingChanges) {
          console.error(`  Section type : ${bc.section_type}`);
          console.error(`  Attribute    : ${bc.attribute}`);
          console.error(`  Change       : ${bc.change} from '${bc.from}' to '${bc.to}'\n`);
        }
        console.error("  Note: existing attribute content may be incompatible with the new type.\n");

        const applyForce = await promptYesNo(
          "Apply breaking changes anyway?",
          false,
        );
        if (!applyForce) {
          console.log("Aborted. Re-run with --force to apply breaking changes non-interactively.");
          // Use a sentinel to avoid double-printing in the catch below
          throw Object.assign(new Error("user_abort"), { handled: true });
        }

        spinner.update(`Deploying with --force to ${domain}`);
        return doDeploy(true);
      }
      throw err;
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    spinner.succeed(`Connected to ${result.website.domain} (website #${result.website.id})`);

    // Section types summary
    console.log("\nSection types");
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
    if (err instanceof Error && (err as Error & { handled?: boolean }).handled) {
      return 0;
    }
    spinner.fail("Deploy failed");

    if (err instanceof WebsiteDeployClientError) {
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

// ─── template-deploy command ──────────────────────────────────────────────────

type SmartCollectionPlaceholderDef = {
  name: string;
  type: string;
  contract_type?: string;
  config?: Record<string, unknown>;
  cache_ttl?: number;
  instantiate_config?: Record<string, unknown>;
};

type TemplateStructure = {
  shell_sections: unknown[];
  smart_collection_placeholders: Record<string, SmartCollectionPlaceholderDef>;
  pages: unknown[];
  layouts: unknown[];
};

function buildTemplateStructure(manifest: ReturnType<typeof loadWebsiteManifest>): TemplateStructure {
  const placeholders = (manifest.smart_collection_placeholders ?? {}) as Record<string, SmartCollectionPlaceholderDef>;
  const placeholderKeys = new Set(Object.keys(placeholders));

  function convertValue(value: unknown, fieldPath: string): unknown {
    if (typeof value === "string" && value.startsWith("auto:")) {
      const key = value.slice("auto:".length);
      if (!placeholderKeys.has(key)) {
        throw new Error(
          `smart_collection_id value '${value}' at '${fieldPath}' references auto key '${key}' ` +
          `which is not declared in smart_collection_placeholders. ` +
          `Add an entry for '${key}' in smart_collection_placeholders or use {"_smart_collection_placeholder": "${key}"}.`
        );
      }
      return { _smart_collection_placeholder: key };
    }
    if (typeof value === "number") {
      if (fieldPath.toLowerCase().includes("smart_collection")) {
        throw new Error(
          `smart_collection_id value at '${fieldPath}' is a numeric ID (${value}). ` +
          `Templates must use {"_smart_collection_placeholder": "key"} or "auto:key" strings instead of raw IDs.`
        );
      }
    }
    if (Array.isArray(value)) {
      return value.map((item, i) => convertValue(item, `${fieldPath}[${i}]`));
    }
    if (value && typeof value === "object") {
      const rec = value as Record<string, unknown>;
      if ("_smart_collection_placeholder" in rec) return rec;
      return Object.fromEntries(
        Object.entries(rec).map(([k, v]) => [k, convertValue(v, `${fieldPath}.${k}`)])
      );
    }
    return value;
  }

  const pages = manifest.pages.map((page) => {
    const sections = (page.scaffold_sections ?? []).map((scaffold, si) => {
      const rawValues = scaffold.default_values ?? {};
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawValues)) {
        values[k] = convertValue(v, `pages[${page.resolver_kind}].scaffold_sections[${si}].default_values.${k}`);
      }
      return {
        name: scaffold.section_type,
        type: scaffold.section_type,
        order: scaffold.order ?? si,
        values,
      };
    });

    const pageEntry: Record<string, unknown> = {
      name: page.label ?? page.resolver_kind,
      path: page.path ?? `/{${page.resolver_kind}}`,
      resolver_kind: page.resolver_kind,
      has_params: !!(page.path ?? "").includes("{"),
      params: ((page.path ?? "").match(/\{([^}]+)\}/g) ?? []).map((m: string) => m.slice(1, -1)),
      order: 0,
      sections,
    };
    return pageEntry;
  });

  const shellDefaultValues = (manifest.shell_default_values ?? {}) as Record<string, Record<string, unknown>>;
  const shellSections = (manifest.shell_sections ?? []).map((shell) => {
    const slot = shell.key;
    const rawValues = shellDefaultValues[slot] ?? {};
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawValues)) {
      values[k] = convertValue(v, `shell_default_values.${slot}.${k}`);
    }
    return {
      slot,
      section_type: shell.section_type ?? slot,
      name: shell.label ?? slot.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      order: shell.order ?? 0,
      values,
    };
  });

  return {
    shell_sections: shellSections,
    smart_collection_placeholders: placeholders,
    pages,
    layouts: [],
  };
}

async function templateDeployCommand(targetPath: string, argv: string[]): Promise<number> {
  const dotenv = loadDotEnv(targetPath);
  const creds  = loadCredentials(targetPath, readFlag(argv, "--credentials"));

  const apiUrl      = resolveVar(readFlag(argv, "--api-url"),      "PROXIMA_API_URL",      creds.api_url,      dotenv);
  const serviceKey  = resolveVar(readFlag(argv, "--service-key"),  "PROXIMA_SERVICE_KEY",  creds.service_key,  dotenv);
  const templateKey = resolveVar(readFlag(argv, "--template-key"), "PROXIMA_TEMPLATE_KEY", creds.template_key, dotenv);
  const dryRun      = argv.includes("--dry-run");

  if (!apiUrl) {
    console.error("✗ PROXIMA_API_URL is required (set in .proxima/credentials.json, .env, or pass --api-url)");
    return 1;
  }
  if (!serviceKey) {
    console.error("✗ PROXIMA_SERVICE_KEY is required (set in .proxima/credentials.json, .env, or pass --service-key)");
    return 1;
  }
  if (!templateKey) {
    console.error("✗ PROXIMA_TEMPLATE_KEY is required (set in .proxima/credentials.json, .env, or pass --template-key)");
    return 1;
  }

  let manifest: ReturnType<typeof loadWebsiteManifest>;
  try {
    manifest = loadWebsiteManifest(targetPath);
  } catch (err: unknown) {
    console.error(`✗ ${(err as Error).message}`);
    return 1;
  }

  let structure: TemplateStructure;
  try {
    structure = buildTemplateStructure(manifest);
  } catch (err: unknown) {
    console.error(`✗ ${(err as Error).message}`);
    return 1;
  }

  const metadata: Record<string, unknown> = {};
  const metadataFields = [
    "name", "short_description", "description", "demo_url",
    "features", "pricing_tier", "color_palette", "tags",
    "category", "industry", "preview_image",
  ] as const;
  for (const field of metadataFields) {
    const value = (manifest as Record<string, unknown>)[field];
    if (value !== undefined && value !== null) {
      metadata[field] = value;
    }
  }

  if (dryRun) {
    console.log("Dry run — no API call made.\n");
    console.log("Template key:", templateKey);
    console.log("Structure:");
    console.log(JSON.stringify(structure, null, 2));
    if (Object.keys(metadata).length > 0) {
      console.log("\nMarketplace metadata:");
      console.log(JSON.stringify(metadata, null, 2));
    }
    return 0;
  }

  const start = Date.now();
  const spinner = createSpinner(`Deploying template structure for ${templateKey}`);
  const url = `${apiUrl.replace(/\/$/, "")}/api/v1/admin/cms/website-templates/${encodeURIComponent(templateKey)}/structure`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ structure, ...metadata }),
    });
  } catch (err: unknown) {
    spinner.fail(`Network error: ${(err as Error).message}`);
    return 1;
  }

  const text = await response.text();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (response.status === 404) {
    spinner.fail(`Template '${templateKey}' not found.`);
    console.error("  Verify PROXIMA_TEMPLATE_KEY matches a template registered in the Proxima admin.");
    return 1;
  }
  if (response.status === 403) {
    spinner.fail("Access denied. The service key does not have cms:templates:write scope.");
    return 1;
  }
  if (!response.ok) {
    spinner.fail(`Deploy failed (${response.status}): ${text}`);
    return 1;
  }

  const pageCount = structure.pages.length;
  const shellCount = structure.shell_sections.length;
  const placeholderCount = Object.keys(structure.smart_collection_placeholders).length;
  const metadataCount = Object.keys(metadata).length;

  spinner.succeed(`Template '${templateKey}' structure deployed in ${elapsed}s`);
  console.log(`  Pages: ${pageCount}  |  Shell sections: ${shellCount}  |  Smart collection placeholders: ${placeholderCount}`);
  if (metadataCount > 0) {
    console.log(`  Marketplace metadata: ${Object.keys(metadata).join(", ")}`);
  }
  return 0;
}

// ─── template-create command ──────────────────────────────────────────────────
//
// Idempotent create-or-update of a cms_website_templates row.
//
// Metadata is sourced from (priority order):
//   1. CLI flags (--name, --description, --category, --pricing-tier, …)
//   2. proxima.website.json → marketplace_metadata block
//   3. proxima.website.json top-level fields (backward compat)
//   4. Sensible defaults (pricing_tier=free, category=ecommerce, …)
//
// Credentials are resolved from (priority order):
//   CLI flag > process.env > .proxima/credentials.json > .env file
//
// Pass --publish-manifest to also upload the structure to S3 and PATCH
// the /manifest pointer on the API.

async function templateCreateCommand(targetPath: string, argv: string[]): Promise<number> {
  const dotenv = loadDotEnv(targetPath);
  const creds  = loadCredentials(targetPath, readFlag(argv, "--credentials"));

  const apiUrl          = resolveVar(readFlag(argv, "--api-url"),        "PROXIMA_API_URL",        creds.api_url,      dotenv);
  const serviceKey      = resolveVar(readFlag(argv, "--service-key"),    "PROXIMA_SERVICE_KEY",    creds.service_key,  dotenv);
  const templateKey     = resolveVar(readFlag(argv, "--template-key"),   "PROXIMA_TEMPLATE_KEY",   creds.template_key, dotenv);
  const s3Bucket        = resolveVar(readFlag(argv, "--s3-bucket"),      "S3_TEMPLATES_BUCKET",    creds.s3_bucket,    dotenv);
  const s3Region        = resolveVar(readFlag(argv, "--s3-region"),      "S3_TEMPLATES_REGION",    creds.s3_region,    dotenv, "AWS_REGION");
  const dryRun          = argv.includes("--dry-run");
  const publishManifest = argv.includes("--publish-manifest");
  const localOnly       = argv.includes("--local-only");

  const nameOverride         = readFlag(argv, "--name");
  const descOverride         = readFlag(argv, "--description");
  const categoryOverride     = readFlag(argv, "--category");
  const pricingTierOverride  = readFlag(argv, "--pricing-tier");
  const demoUrlOverride      = readFlag(argv, "--demo-url");
  const previewImageOverride = readFlag(argv, "--preview-image");
  const tagsOverride         = readFlag(argv, "--tags");

  if (!apiUrl) {
    console.error("✗ PROXIMA_API_URL is required (set in .proxima/credentials.json, .env, or pass --api-url)");
    return 1;
  }
  if (!serviceKey) {
    console.error("✗ PROXIMA_SERVICE_KEY is required (set in .proxima/credentials.json, .env, or pass --service-key)");
    return 1;
  }
  if (!templateKey) {
    console.error("✗ PROXIMA_TEMPLATE_KEY is required (set in .proxima/credentials.json, .env, or pass --template-key)");
    return 1;
  }

  // Read raw JSON before schema validation (which strips unknown fields like marketplace_metadata).
  let rawManifest: Record<string, unknown> = {};
  let manifest: ReturnType<typeof loadWebsiteManifest> | null = null;
  const manifestPath = findWebsiteManifestPath(targetPath);
  if (manifestPath) {
    try {
      rawManifest = readJson(manifestPath) as Record<string, unknown>;
      manifest = loadWebsiteManifest(targetPath);
    } catch (err: unknown) {
      console.error(`✗ ${(err as Error).message}`);
      return 1;
    }
  }

  const marketplaceMeta = (rawManifest.marketplace_metadata ?? {}) as Record<string, unknown>;
  const topLevel = rawManifest;

  const tags = tagsOverride
    ? tagsOverride.split(",").map((t) => t.trim()).filter(Boolean)
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
      "",
    category:
      categoryOverride ??
      (marketplaceMeta.category as string | undefined) ??
      (topLevel.category as string | undefined) ??
      "ecommerce",
    pricing_tier:
      pricingTierOverride ??
      (marketplaceMeta.pricing_tier as string | undefined) ??
      "free",
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

  let structure: TemplateStructure | null = null;
  if (publishManifest) {
    if (!manifest) {
      console.error("✗ proxima.website.json not found — required for --publish-manifest");
      return 1;
    }
    try {
      structure = buildTemplateStructure(manifest);
    } catch (err: unknown) {
      console.error(`✗ ${(err as Error).message}`);
      return 1;
    }
  }

  const manifestKey = `${templateKey}/manifest.json`;
  const useLocalMode = localOnly || !s3Bucket;

  if (dryRun) {
    console.log("Dry run — no API call made.\n");
    console.log(`Template key: ${templateKey}`);
    console.log("Action: POST (create) or PATCH (update) — determined at runtime by GET check");
    console.log("\nPayload:");
    console.log(JSON.stringify(payload, null, 2));
    if (publishManifest && structure) {
      console.log(`\nManifest mode: ${useLocalMode ? `local (TEMPLATES_LOCAL_FALLBACK_DIR/${manifestKey})` : `S3 s3://${s3Bucket}/${manifestKey} (region=${s3Region ?? "default"})`}`);
      console.log("\nStructure:");
      console.log(JSON.stringify(structure, null, 2));
    }
    return 0;
  }

  const start = Date.now();
  const baseUrl = apiUrl.replace(/\/$/, "");
  const spinner = createSpinner(`Checking template '${templateKey}'`);

  // Step 1 — check if the template already exists
  let existingId: string | null = null;
  try {
    const checkRes = await fetchWithRetry(
      `${baseUrl}/api/v1/admin/cms/website-templates?template_key=${encodeURIComponent(templateKey)}`,
      { headers: { authorization: `Bearer ${serviceKey}` } },
    );
    if (checkRes.ok) {
      const data = await checkRes.json() as unknown;
      const items = Array.isArray(data)
        ? (data as Array<Record<string, unknown>>)
        : (((data as Record<string, unknown>).items ?? (data as Record<string, unknown>).results ?? []) as Array<Record<string, unknown>>);
      const match = items.find((t) => t.template_key === templateKey);
      existingId = (match?.id as string | undefined) ?? null;
    } else if (checkRes.status === 403) {
      spinner.fail("Access denied. The service key does not have cms:templates:write scope.");
      return 1;
    } else if (checkRes.status !== 404) {
      const text = await checkRes.text();
      spinner.fail(`Failed to check template existence (${checkRes.status}): ${text}`);
      return 1;
    }
  } catch (err: unknown) {
    spinner.fail(`Network error checking template: ${(err as Error).message}`);
    return 1;
  }

  // Step 2 — create or update the template row
  const action = existingId ? "updated" : "created";
  spinner.update(existingId ? `Updating template '${templateKey}'` : `Creating template '${templateKey}'`);

  let rowResponse: Response;
  try {
    if (existingId) {
      rowResponse = await fetchWithRetry(`${baseUrl}/api/v1/admin/cms/website-templates/${existingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify(payload),
      });
    } else {
      rowResponse = await fetchWithRetry(`${baseUrl}/api/v1/admin/cms/website-templates`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify(payload),
      });
    }
  } catch (err: unknown) {
    spinner.fail(`Network error: ${(err as Error).message}`);
    return 1;
  }

  const rowText = await rowResponse.text();
  if (rowResponse.status === 403) {
    spinner.fail("Access denied. The service key does not have cms:templates:write scope.");
    return 1;
  }
  if (!rowResponse.ok) {
    spinner.fail(`Template ${action} failed (${rowResponse.status}): ${rowText}`);
    return 1;
  }

  let createdRow: Record<string, unknown> = {};
  try { createdRow = JSON.parse(rowText) as Record<string, unknown>; } catch { /* ignore */ }

  const elapsed1 = ((Date.now() - start) / 1000).toFixed(1);
  spinner.succeed(`Template '${templateKey}' ${action} (id=${createdRow.id ?? "?"}) in ${elapsed1}s`);

  if (!publishManifest || !structure) {
    return 0;
  }

  // Step 3 — upload structure to S3 (or skip in local mode)
  const spinner2 = createSpinner("Uploading manifest");
  let manifestVersionId: string | undefined;
  if (!useLocalMode) {
    try {
      manifestVersionId = await uploadManifestToS3({
        bucket: s3Bucket!,
        key: manifestKey,
        region: s3Region,
        body: JSON.stringify(structure),
      });
      spinner2.succeed(`Uploaded ${manifestKey} to s3://${s3Bucket} (VersionId=${manifestVersionId})`);
    } catch (err: unknown) {
      spinner2.fail(`S3 upload failed: ${(err as Error).message}`);
      console.error("  Check AWS credentials and that the 'aws' CLI is installed and on PATH.");
      return 1;
    }
  } else {
    spinner2.stop();
    console.log(`  Local mode — skipped S3 upload. API reads from TEMPLATES_LOCAL_FALLBACK_DIR/${manifestKey}`);
  }

  // Step 4 — PATCH /manifest on the API with the S3 pointer
  const spinner3 = createSpinner("Publishing manifest pointer");
  const manifestUrl = `${baseUrl}/api/v1/admin/cms/website-templates/${encodeURIComponent(templateKey)}/manifest`;
  let manifestResponse: Response;
  try {
    manifestResponse = await fetchWithRetry(manifestUrl, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        manifest_s3_key: manifestKey,
        manifest_s3_version_id: manifestVersionId ?? null,
      }),
    });
  } catch (err: unknown) {
    spinner3.fail(`Network error patching manifest: ${(err as Error).message}`);
    return 1;
  }

  const manifestText = await manifestResponse.text();
  const elapsed2 = ((Date.now() - start) / 1000).toFixed(1);

  if (manifestResponse.status === 404) {
    spinner3.fail(`Template '${templateKey}' not found when patching manifest (unexpected after create/update).`);
    return 1;
  }
  if (manifestResponse.status === 403) {
    spinner3.fail("Access denied patching manifest.");
    return 1;
  }
  if (!manifestResponse.ok) {
    spinner3.fail(`Manifest deploy failed (${manifestResponse.status}): ${manifestText}`);
    return 1;
  }

  const pageCount = structure.pages.length;
  const shellCount = structure.shell_sections.length;
  const placeholderCount = Object.keys(structure.smart_collection_placeholders).length;

  spinner3.succeed(`Manifest published in ${elapsed2}s`);
  console.log(`  Pages: ${pageCount}  |  Shell sections: ${shellCount}  |  Smart collection placeholders: ${placeholderCount}`);
  if (manifestVersionId) {
    console.log(`  Manifest:  s3://${s3Bucket}/${manifestKey}`);
    console.log(`  VersionId: ${manifestVersionId}`);
  } else {
    console.log(`  Manifest:  (local) ${manifestKey}`);
  }
  return 0;
}

/**
 * template-publish — backward-compatible alias for `template-create --publish-manifest`.
 */
async function templatePublishCommand(targetPath: string, argv: string[]): Promise<number> {
  const args = argv.includes("--publish-manifest") ? argv : [...argv, "--publish-manifest"];
  return templateCreateCommand(targetPath, args);
}

// ─── Network helpers ──────────────────────────────────────────────────────────

/**
 * Fetch with simple exponential-backoff retry on 5xx errors (3 attempts).
 */
async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || i === attempts - 1) return res;
      await new Promise<void>((r) => setTimeout(r, 500 * 2 ** i));
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      await new Promise<void>((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastError ?? new Error("fetch failed after retries");
}

/**
 * Shell out to `aws s3api put-object` to upload a manifest. Avoids pulling the
 * AWS SDK as a dependency — the AWS CLI is universally available on CI runners.
 */
async function uploadManifestToS3(args: {
  bucket: string;
  key: string;
  region?: string;
  body: string;
}): Promise<string> {
  const { spawn } = await import("node:child_process");
  return new Promise<string>((resolve, reject) => {
    const cliArgs = [
      "s3api",
      "put-object",
      "--bucket", args.bucket,
      "--key", args.key,
      "--body", "-",
      "--content-type", "application/json",
      "--output", "json",
    ];
    if (args.region) {
      cliArgs.push("--region", args.region);
    }
    const proc = spawn("aws", cliArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", (err) => reject(new Error(`Failed to spawn aws CLI: ${err.message}`)));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`aws s3api put-object exited ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout || "{}") as { VersionId?: string };
        resolve(parsed.VersionId ?? "null");
      } catch (err: unknown) {
        reject(new Error(`Failed to parse aws CLI response: ${(err as Error).message}`));
      }
    });
    proc.stdin.write(args.body);
    proc.stdin.end();
  });
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp(unknownCommand?: string) {
  if (unknownCommand) {
    console.error(`Unknown command: ${unknownCommand}\n`);
  }
  console.log(`Usage: proxima-templateizer <command> [target] [options]

SETUP
  init              Interactive setup wizard — creates .proxima/credentials.json
                    and adds it to .gitignore. Use instead of managing .env manually.

WEBSITE DEPLOY
  website-deploy    Deploy section types + page scaffolding to a specific website.

    Options:
      --dry-run                  Print the payload without calling the API.
      --force                    Apply breaking changes without prompting.
      --yes, -y                  Skip the pre-deploy confirmation prompt (useful in CI).
      --page <path>              Deploy only this page (repeatable: --page /a --page /b).
                                 Matches against page path or resolver_kind.
      --domain <domain>          Override PROXIMA_DOMAIN.
      --service-key <k>          Override PROXIMA_SERVICE_KEY.
      --api-url <url>            Override PROXIMA_API_URL.
      --credentials <file.json>  Path to a credentials JSON file.

    Credentials (highest → lowest priority):
      CLI flags  >  process.env  >  --credentials / .proxima/credentials.json  >  .env

TEMPLATE COMMANDS
  validate          Validate one template or template tree (proxima.template.json).
  register          Create or update a draft WebsiteTemplate in proxima-api.
  deploy            Patch deployment_config for a registered template.
  publish           Mark a registered template as published.
  sync              validate → register → [deploy] → [publish].
  status            Show admin registry state and storefront visibility.

    Options (register / deploy / publish / sync / status):
      --dry-run         Print planned action without calling the API.
      --api-url <url>   Override PROXIMA_API_URL.
      --token <token>   Override PROXIMA_API_TOKEN.
      --publish         Also publish during sync.

  template-deploy   [LEGACY] Push inline structure to the template DB column.

    Options:
      --dry-run                  Print structure JSON without calling the API.
      --template-key <k>         Override PROXIMA_TEMPLATE_KEY.
      --service-key <k>          Override PROXIMA_SERVICE_KEY.
      --api-url <url>            Override PROXIMA_API_URL.
      --credentials <file.json>  Path to a credentials JSON file.

  template-create   Idempotent create-or-update of a template row in the API.

    Options:
      --dry-run             Print planned payload without calling the API.
      --publish-manifest    Also upload structure to S3 and PATCH the manifest pointer.
      --local-only          Skip S3 upload (API reads from TEMPLATES_LOCAL_FALLBACK_DIR).
      --s3-bucket <bucket>  Override S3_TEMPLATES_BUCKET.
      --s3-region <region>  Override S3_TEMPLATES_REGION (defaults to AWS_REGION).
      --template-key <k>    Override PROXIMA_TEMPLATE_KEY.
      --service-key <k>     Override PROXIMA_SERVICE_KEY.
      --api-url <url>       Override PROXIMA_API_URL.
      --name <string>       Template display name.
      --description <str>   Short description shown in the marketplace.
      --category <str>      Category (default: ecommerce).
      --pricing-tier <str>  Pricing tier: free | pro  (default: free).
      --demo-url <url>      Live demo URL (default: https://<template-key>.proxima.pe).
      --preview-image <url>      Hero preview image URL.
      --tags <a,b,c>             Comma-separated tags.
      --credentials <file.json>  Path to a credentials JSON file.

    Metadata priority: CLI flags > marketplace_metadata block > top-level fields > defaults.

  template-publish  Alias for template-create --publish-manifest (backward compat).

ARTIFACT GENERATION (no API calls)
  scan              Detect pages and source files.
  snapshot          Create auditable snapshot artifacts.
  analyze           Infer pages, sections, attributes, collections.
  infer-schema      Emit attribute schema artifacts from manifest.
  infer-collections Emit Smart Collection placeholder artifacts.
  codemod           Prepare codemod audit artifacts.
  preview           Print local preview instructions.

CREDENTIALS FILE
  .proxima/credentials.json (or proxima-credentials.json at project root):

    {
      "api_url":     "https://api.proxima.io",
      "service_key": "pxa_live_...",
      "domain":      "mystore.proxima.app",
      "template_key": "my-template"   // optional
    }

  Run \`proxima-templateizer init\` to create this file interactively.
  Never commit it — init adds it to .gitignore automatically.

ENV VARS (alternative to credentials file)
  PROXIMA_API_URL        API base URL
  PROXIMA_SERVICE_KEY    Bearer token (cms:websites:write scope)
  PROXIMA_DOMAIN         Website domain
  PROXIMA_TEMPLATE_KEY   Template key (template commands only)
  PROXIMA_API_TOKEN      Token for template registry commands
  S3_TEMPLATES_BUCKET    S3 bucket for manifest uploads
  S3_TEMPLATES_REGION    S3 region (defaults to AWS_REGION)

  Set NO_INTERACTIVE=1 (or CI=1) to disable all interactive prompts.
`);
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

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
