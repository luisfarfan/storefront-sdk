#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cancel, confirm, intro, isCancel, log, outro, password, text } from "@clack/prompts";
import pc from "picocolors";
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

const isCI = Boolean(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.NO_INTERACTIVE ||
  !process.stdin.isTTY,
);

// ─── Color helpers ────────────────────────────────────────────────────────────

const sym = {
  ok:        (msg: string) => `${pc.green("✓")} ${msg}`,
  err:       (msg: string) => `${pc.red("✗")} ${msg}`,
  warn:      (msg: string) => `${pc.yellow("⚠")} ${msg}`,
  created:   (key: string, extra = "") => `  ${pc.green("+")} created    ${pc.cyan(key)}${extra}`,
  updated:   (key: string) => `  ${pc.yellow("~")} updated    ${pc.cyan(key)}`,
  unchanged: (keys: string) => `  ${pc.dim("·")} unchanged  ${pc.dim(keys)}`,
  skipped:   (key: string, reason: string) => `  ${pc.dim("·")} skipped    ${key}  ${pc.dim(`(${reason})`)}`,
  scaffolded:(key: string, sections: string) => `  ${pc.cyan("→")} scaffolded ${pc.cyan(key)} ${pc.dim(`[${sections}]`)}`,
  bullet:    (msg: string) => `  ${pc.dim("·")} ${msg}`,
  hint:      (msg: string) => `  ${pc.dim(msg)}`,
};

// ─── Credentials JSON support ─────────────────────────────────────────────────

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
      console.error(sym.err(`Credentials file not found: ${pc.cyan(resolved)}`));
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
    console.error(sym.err(`Failed to read credentials file ${pc.cyan(credPath)}: ${(err as Error).message}`));
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

function createSpinner(initialText: string): Spinner {
  const isTTY = process.stderr.isTTY;
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let current = initialText;

  if (!isTTY) {
    process.stderr.write(`  ${initialText}...\n`);
    return {
      update: (t) => { current = t; process.stderr.write(`  ${t}...\n`); },
      succeed: (t) => process.stderr.write(`${sym.ok(t)}\n`),
      fail:    (t) => process.stderr.write(`${sym.err(t)}\n`),
      stop:    () => {},
    };
  }

  const interval = setInterval(() => {
    process.stderr.write(`\r${pc.cyan(frames[i % frames.length])} ${current}   `);
    i++;
  }, 80);

  const clear = () => {
    clearInterval(interval);
    process.stderr.write(`\r${" ".repeat(current.length + 6)}\r`);
  };

  return {
    update: (t) => { current = t; },
    succeed: (t) => { clear(); process.stderr.write(`${sym.ok(t)}\n`); },
    fail:    (t) => { clear(); process.stderr.write(`${sym.err(t)}\n`); },
    stop:    () => { clear(); },
  };
}

// ─── Interactive prompts ──────────────────────────────────────────────────────

async function promptText(question: string, defaultValue?: string): Promise<string> {
  if (isCI) return defaultValue ?? "";
  const result = await text({
    message: question,
    placeholder: defaultValue,
    defaultValue,
  });
  if (isCancel(result)) { cancel("Setup cancelled."); process.exit(0); }
  return (result as string) || defaultValue || "";
}

async function promptHidden(question: string): Promise<string> {
  if (isCI) return "";
  const result = await password({ message: question });
  if (isCancel(result)) { cancel("Setup cancelled."); process.exit(0); }
  return result as string;
}

async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  if (isCI) return defaultYes;
  const result = await confirm({ message: question, initialValue: defaultYes });
  if (isCancel(result)) { cancel("Cancelled."); process.exit(0); }
  return result as boolean;
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
    console.log("Run preview with: " + pc.cyan("pnpm --filter @proxima-io/catalog-preview dev"));
    console.log(`Template target: ${pc.dim(targetPath)}`);
    return 0;
  }

  const artifacts = buildArtifacts(targetPath, command);
  writeArtifacts(targetPath, artifacts);
  console.log(sym.ok(`Templateizer ${pc.bold(command)} complete. Artifacts written to ${pc.dim(artifactDir(targetPath))}`));
  return 0;
}

// ─── Init command ─────────────────────────────────────────────────────────────

async function initCommand(targetPath: string): Promise<number> {
  const dotenv = loadDotEnv(targetPath);

  intro(`${pc.bold("Proxima CLI")}  ${pc.dim("— Project Setup")}`);

  log.info(`Creates ${pc.cyan(".proxima/credentials.json")} with your API credentials.`);
  log.info(`This file is never committed (added to ${pc.cyan(".gitignore")} automatically).`);

  const existingCredPath = findCredentialsPath(targetPath);
  if (existingCredPath) {
    const rel = path.relative(process.cwd(), existingCredPath);
    log.warn(`Found existing credentials: ${pc.cyan(rel)}`);
    const overwrite = await promptYesNo("Overwrite?", false);
    if (!overwrite) {
      cancel("Setup cancelled.");
      return 0;
    }
  }

  const defaultApiUrl      = process.env.PROXIMA_API_URL      ?? dotenv.PROXIMA_API_URL      ?? "https://api.proxima.io";
  const defaultDomain      = process.env.PROXIMA_DOMAIN       ?? dotenv.PROXIMA_DOMAIN       ?? dotenv.PROXIMA_WEBSITE_DOMAIN ?? "";
  const defaultTemplateKey = process.env.PROXIMA_TEMPLATE_KEY ?? dotenv.PROXIMA_TEMPLATE_KEY ?? "";

  const apiUrl      = await promptText("API URL", defaultApiUrl);
  const domain      = await promptText("Website domain  (e.g. mystore.proxima.app)", defaultDomain || undefined);
  const serviceKey  = await promptHidden("Service key     (pxa_live_... or pxa_test_...)");
  const templateKey = await promptText("Template key    (optional — leave blank if not needed)", defaultTemplateKey || undefined);

  if (!domain) {
    log.error("Domain is required.");
    return 1;
  }
  if (!serviceKey) {
    log.error("Service key is required.");
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

  const credDir  = path.join(targetPath, ".proxima");
  const credPath = path.join(credDir, "credentials.json");
  mkdirSync(credDir, { recursive: true });
  writeFileSync(credPath, `${JSON.stringify(creds, null, 2)}\n`);

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
  log.success(`Credentials saved to ${pc.cyan(relCred)}`);
  if (gitignoreUpdated) {
    log.success(`Added ${pc.cyan(gitignoreEntry)} to .gitignore`);
  }

  outro(`${pc.green("Ready!")}  Run: ${pc.cyan("proxima-templateizer website-deploy --dry-run")}`);
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
    console.error(sym.err(`No proxima.template.json files found under ${pc.dim(targetPath)}`));
    return 1;
  }

  let failed = false;
  for (const manifestPath of manifests) {
    const value = readJson(manifestPath);
    const result = validateTemplateManifest(value);
    if (!result.success) {
      failed = true;
      console.error(sym.err(`Invalid manifest: ${pc.cyan(manifestPath)}`));
      for (const issue of result.error.issues) {
        console.error(sym.hint(`${issue.path.join(".") || "(root)"}: ${issue.message}`));
      }
    } else {
      console.log(sym.ok(`Valid manifest: ${pc.cyan(manifestPath)}`));
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
      sym.warn("proxima.website.json not found. Falling back to proxima.template.json\n") +
      sym.hint("Consider creating proxima.website.json for the website-deploy command."),
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

function readFlagAll(argv: string[], name: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === name) {
      results.push(argv[i + 1]);
    }
  }
  return results;
}

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

  if (!apiUrl) {
    console.error(sym.err("PROXIMA_API_URL is required."));
    console.error(sym.hint("Set it in .proxima/credentials.json or pass --api-url"));
    console.error(sym.hint(`Run: ${pc.cyan("proxima-templateizer init")}`));
    return 1;
  }
  if (!serviceKey) {
    console.error(sym.err("PROXIMA_SERVICE_KEY is required."));
    console.error(sym.hint("Set it in .proxima/credentials.json or pass --service-key"));
    console.error(sym.hint(`Run: ${pc.cyan("proxima-templateizer init")}`));
    return 1;
  }
  if (!domain) {
    console.error(sym.err("PROXIMA_DOMAIN is required."));
    console.error(sym.hint("Set it in .proxima/credentials.json or pass --domain"));
    console.error(sym.hint(`Run: ${pc.cyan("proxima-templateizer init")}`));
    return 1;
  }

  let manifest: WebsiteDeployManifest;
  try {
    manifest = loadWebsiteManifest(targetPath);
  } catch (err: unknown) {
    console.error(sym.err((err as Error).message));
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
      console.error(sym.err(`No pages matched filter: ${pc.cyan(pageFilter.join(", "))}`));
      console.error(sym.hint(`Available: ${available}`));
      return 1;
    }
    const matched = pagesToDeploy
      .map((p) => {
        const page = p as Record<string, unknown>;
        return page["path"] ?? page["resolver_kind"];
      })
      .join(", ");
    console.log(`Deploying ${pc.bold(String(pagesToDeploy.length))} page(s): ${pc.cyan(matched)}\n`);
  }

  // Dry run
  if (dryRun) {
    console.log(pc.dim("Dry run — no API call made.\n"));
    console.log(pc.bold("Payload:"));
    console.log(JSON.stringify({
      website_domain: domain,
      section_types: manifest.section_types,
      pages: pagesToDeploy,
      shell_sections: manifest.shell_sections ?? [],
    }, null, 2));
    return 0;
  }

  // Pre-deploy confirmation
  if (!skipPrompt) {
    console.log(`\nDeploy to: ${pc.bold(pc.cyan(domain))}`);
    console.log(pc.dim(`  ${manifest.section_types.length} section type(s)  ·  ${pagesToDeploy.length} page(s)\n`));
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
        console.error(`\n${sym.warn("Breaking changes detected:")}\n`);
        for (const bc of err.breakingChanges) {
          console.error(`  ${pc.dim("Section type :")} ${pc.cyan(bc.section_type)}`);
          console.error(`  ${pc.dim("Attribute    :")} ${bc.attribute}`);
          console.error(`  ${pc.dim("Change       :")} ${bc.change} ${pc.dim("from")} ${pc.yellow(`'${bc.from}'`)} ${pc.dim("to")} ${pc.yellow(`'${bc.to}'`)}\n`);
        }
        console.error(sym.hint("Note: existing attribute content may be incompatible with the new type.\n"));

        const applyForce = await promptYesNo("Apply breaking changes anyway?", false);
        if (!applyForce) {
          console.log(`Aborted. Re-run with ${pc.yellow("--force")} to apply breaking changes non-interactively.`);
          throw Object.assign(new Error("user_abort"), { handled: true });
        }

        spinner.update(`Deploying with ${pc.yellow("--force")} to ${pc.cyan(domain)}`);
        return doDeploy(true);
      }
      throw err;
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    spinner.succeed(`Connected to ${pc.cyan(result.website.domain)} ${pc.dim(`(website #${result.website.id})`)}`);

    // Section types summary
    console.log(`\n${pc.bold("Section types")}`);
    for (const key of result.section_types.created)   console.log(sym.created(key));
    for (const key of result.section_types.updated)   console.log(sym.updated(key));
    if (result.section_types.unchanged.length) {
      console.log(sym.unchanged(result.section_types.unchanged.join(", ")));
    }

    // Pages summary
    console.log(`\n${pc.bold("Pages")}`);
    for (const pageId of result.pages.created) {
      const scaffolded = result.pages.scaffolded[pageId];
      if (scaffolded?.length) {
        console.log(sym.created(pageId, `  ${pc.cyan("→")}  scaffolded ${pc.dim(`[${scaffolded.join(", ")}]`)}`));
      } else {
        console.log(sym.created(pageId));
      }
    }
    for (const [pageId, reason] of Object.entries(result.pages.skipped)) {
      console.log(sym.skipped(pageId, reason));
    }

    // Warnings
    if (result.warnings.length) {
      console.log(`\n${pc.yellow("⚠ Warnings")}`);
      for (const warning of result.warnings) console.log(sym.bullet(warning));
    }

    console.log(`\n${sym.ok(`Deploy completed in ${pc.dim(elapsed + "s")}`)} `);
    return 0;

  } catch (err: unknown) {
    if (err instanceof Error && (err as Error & { handled?: boolean }).handled) {
      return 0;
    }
    spinner.fail("Deploy failed");

    if (err instanceof WebsiteDeployClientError) {
      if (err.status === 404) {
        console.error(sym.err(`Website ${pc.cyan(`'${domain}'`)} not found.`));
        console.error(sym.hint("Verify PROXIMA_DOMAIN matches a website configured in the Proxima admin."));
        return 1;
      }
      if (err.status === 403) {
        console.error(sym.err("Access denied. The service key does not have access to this website."));
        return 1;
      }
      console.error(sym.err(`Deploy failed ${pc.dim(`(${err.status ?? "network error"})`)}: ${err.message}`));
      if (err.responseText) console.error(sym.hint(err.responseText));
      return 1;
    }
    console.error(sym.err(`Unexpected error: ${(err as Error).message}`));
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
      // Prefer the canonical `values` field; fall back to legacy `default_values`
      // so existing 214store/nocturna manifests keep working until migrated.
      const rawValues = scaffold.values ?? scaffold.default_values ?? {};
      const fieldName = scaffold.values ? "values" : "default_values";
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawValues)) {
        values[k] = convertValue(v, `pages[${page.resolver_kind}].scaffold_sections[${si}].${fieldName}.${k}`);
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
    // Prefer the canonical per-entry `values`; fall back to the legacy top-level
    // `shell_default_values[slot]` map.
    const rawValues = shell.values ?? shellDefaultValues[slot] ?? {};
    const fieldPath = shell.values
      ? `shell_sections[${slot}].values`
      : `shell_default_values.${slot}`;
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawValues)) {
      values[k] = convertValue(v, `${fieldPath}.${k}`);
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
    console.error(sym.err(`PROXIMA_API_URL is required ${pc.dim("(set in .proxima/credentials.json, .env, or pass --api-url)")}`));
    return 1;
  }
  if (!serviceKey) {
    console.error(sym.err(`PROXIMA_SERVICE_KEY is required ${pc.dim("(set in .proxima/credentials.json, .env, or pass --service-key)")}`));
    return 1;
  }
  if (!templateKey) {
    console.error(sym.err(`PROXIMA_TEMPLATE_KEY is required ${pc.dim("(set in .proxima/credentials.json, .env, or pass --template-key)")}`));
    return 1;
  }

  let manifest: ReturnType<typeof loadWebsiteManifest>;
  try {
    manifest = loadWebsiteManifest(targetPath);
  } catch (err: unknown) {
    console.error(sym.err((err as Error).message));
    return 1;
  }

  let structure: TemplateStructure;
  try {
    structure = buildTemplateStructure(manifest);
  } catch (err: unknown) {
    console.error(sym.err((err as Error).message));
    return 1;
  }

  if (dryRun) {
    console.log(pc.dim("Dry run — no API call made.\n"));
    console.log(`Template key: ${pc.cyan(templateKey)}`);
    console.log("Structure:");
    console.log(JSON.stringify(structure, null, 2));
    return 0;
  }

  const start = Date.now();
  const spinner = createSpinner(`Deploying template structure for ${pc.cyan(templateKey)}`);
  const url = `${apiUrl.replace(/\/$/, "")}/api/v1/admin/cms/website-templates/${encodeURIComponent(templateKey)}/structure`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ structure }),
    });
  } catch (err: unknown) {
    spinner.fail(`Network error: ${(err as Error).message}`);
    return 1;
  }

  const text2 = await response.text();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (response.status === 404) {
    spinner.fail(`Template ${pc.cyan(`'${templateKey}'`)} not found.`);
    console.error(sym.hint("Verify PROXIMA_TEMPLATE_KEY matches a template registered in the Proxima admin."));
    return 1;
  }
  if (response.status === 403) {
    spinner.fail("Access denied. The service key does not have cms:templates:write scope.");
    return 1;
  }
  if (!response.ok) {
    spinner.fail(`Deploy failed ${pc.dim(`(${response.status})`)}: ${text2}`);
    return 1;
  }

  const pageCount = structure.pages.length;
  const shellCount = structure.shell_sections.length;
  const placeholderCount = Object.keys(structure.smart_collection_placeholders).length;

  spinner.succeed(`Template ${pc.cyan(`'${templateKey}'`)} structure deployed ${pc.dim(elapsed + "s")}`);
  console.log(sym.hint(`Pages: ${pageCount}  ·  Shell sections: ${shellCount}  ·  Smart collection placeholders: ${placeholderCount}`));
  return 0;
}

// ─── template-create command ──────────────────────────────────────────────────

async function templateCreateCommand(targetPath: string, argv: string[]): Promise<number> {
  const dotenv = loadDotEnv(targetPath);
  const creds  = loadCredentials(targetPath, readFlag(argv, "--credentials"));

  const apiUrl          = resolveVar(readFlag(argv, "--api-url"),        "PROXIMA_API_URL",        creds.api_url,      dotenv);
  const serviceKey      = resolveVar(readFlag(argv, "--service-key"),    "PROXIMA_SERVICE_KEY",    creds.service_key,  dotenv);
  const templateKey     = resolveVar(readFlag(argv, "--template-key"),   "PROXIMA_TEMPLATE_KEY",   creds.template_key, dotenv);
  const dryRun          = argv.includes("--dry-run");
  const publishManifest = argv.includes("--publish-manifest");
  // --s3-bucket / --s3-region / --local-only are accepted silently for
  // backwards compat with CI invocations. The CLI no longer writes to S3 —
  // the API does (via the `/publish` endpoint), so these flags are no-ops.

  const nameOverride         = readFlag(argv, "--name");
  const descOverride         = readFlag(argv, "--description");
  const categoryOverride     = readFlag(argv, "--category");
  const pricingTierOverride  = readFlag(argv, "--pricing-tier");
  const demoUrlOverride      = readFlag(argv, "--demo-url");
  const previewImageOverride = readFlag(argv, "--preview-image");
  const tagsOverride         = readFlag(argv, "--tags");

  if (!apiUrl) {
    console.error(sym.err(`PROXIMA_API_URL is required ${pc.dim("(set in .proxima/credentials.json, .env, or pass --api-url)")}`));
    return 1;
  }
  if (!serviceKey) {
    console.error(sym.err(`PROXIMA_SERVICE_KEY is required ${pc.dim("(set in .proxima/credentials.json, .env, or pass --service-key)")}`));
    return 1;
  }
  if (!templateKey) {
    console.error(sym.err(`PROXIMA_TEMPLATE_KEY is required ${pc.dim("(set in .proxima/credentials.json, .env, or pass --template-key)")}`));
    return 1;
  }

  let rawManifest: Record<string, unknown> = {};
  let manifest: ReturnType<typeof loadWebsiteManifest> | null = null;
  const manifestPath = findWebsiteManifestPath(targetPath);
  if (manifestPath) {
    try {
      rawManifest = readJson(manifestPath) as Record<string, unknown>;
      manifest = loadWebsiteManifest(targetPath);
    } catch (err: unknown) {
      console.error(sym.err((err as Error).message));
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
      console.error(sym.err(`proxima.website.json not found — required for ${pc.yellow("--publish-manifest")}`));
      return 1;
    }
    try {
      structure = buildTemplateStructure(manifest);
    } catch (err: unknown) {
      console.error(sym.err((err as Error).message));
      return 1;
    }
  }

  if (dryRun) {
    console.log(pc.dim("Dry run — no API call made.\n"));
    console.log(`Template key: ${pc.cyan(templateKey)}`);
    console.log("Action: POST (create) or PATCH (update) — determined at runtime by GET check");
    console.log("\nPayload:");
    console.log(JSON.stringify(payload, null, 2));
    if (publishManifest && structure) {
      console.log(`\nManifest publish endpoint: ${pc.cyan(`POST /api/v1/admin/cms/website-templates/${templateKey}/publish`)}`);
      console.log(pc.dim("(The API validates required values and uploads the manifest to S3.)"));
      console.log("\nStructure:");
      console.log(JSON.stringify(structure, null, 2));
    }
    return 0;
  }

  const start = Date.now();
  const baseUrl = apiUrl.replace(/\/$/, "");
  const spinner = createSpinner(`Checking template ${pc.cyan(`'${templateKey}'`)}`);

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
      const text2 = await checkRes.text();
      spinner.fail(`Failed to check template existence ${pc.dim(`(${checkRes.status})`)}: ${text2}`);
      return 1;
    }
  } catch (err: unknown) {
    spinner.fail(`Network error checking template: ${(err as Error).message}`);
    return 1;
  }

  const action = existingId ? "updated" : "created";
  spinner.update(existingId ? `Updating template ${pc.cyan(`'${templateKey}'`)}` : `Creating template ${pc.cyan(`'${templateKey}'`)}`);

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
    spinner.fail(`Template ${action} failed ${pc.dim(`(${rowResponse.status})`)}: ${rowText}`);
    return 1;
  }

  let createdRow: Record<string, unknown> = {};
  try { createdRow = JSON.parse(rowText) as Record<string, unknown>; } catch { /* ignore */ }

  const elapsed1 = ((Date.now() - start) / 1000).toFixed(1);
  spinner.succeed(`Template ${pc.cyan(`'${templateKey}'`)} ${action} ${pc.dim(`(id=${createdRow.id ?? "?"})`)} ${pc.dim(elapsed1 + "s")}`);

  if (!publishManifest || !manifest) {
    return 0;
  }

  // Step 3 — single round trip: POST /publish with the manifest shape
  // (section_types + pages with scaffold_sections + shell_sections with key).
  // The API validates every is_required attribute, converts to TemplateStructure,
  // uploads to S3 (single custodian — CLI no longer writes directly), pins the
  // VersionId on the template row, and optionally refreshes marketplace metadata.
  // Replaces the legacy "aws s3 put-object" + "PATCH /manifest" two-step that
  // ran from the developer's local AWS credentials.
  const spinner2 = createSpinner("Validating + publishing manifest");
  const publishUrl = `${baseUrl}/api/v1/admin/cms/website-templates/${encodeURIComponent(templateKey)}/publish`;

  const shellDefaultValues = (manifest.shell_default_values ?? {}) as Record<string, Record<string, unknown>>;

  const publishBody: Record<string, unknown> = {
    section_types: manifest.section_types,
    pages: manifest.pages.map((page) => ({
      resolver_kind: page.resolver_kind,
      ...(page.path !== undefined && { path: page.path }),
      ...(page.label !== undefined && { label: page.label }),
      scaffold_sections: (page.scaffold_sections ?? []).map((sc) => ({
        section_type: sc.section_type,
        order: sc.order ?? 0,
        values: sc.values ?? sc.default_values ?? {},
      })),
    })),
    shell_sections: (manifest.shell_sections ?? []).map((sh) => ({
      key: sh.key,
      ...(sh.section_type !== undefined && { section_type: sh.section_type }),
      ...(sh.label !== undefined && { label: sh.label }),
      order: sh.order ?? 0,
      values: sh.values ?? shellDefaultValues[sh.key] ?? {},
    })),
    smart_collection_placeholders: manifest.smart_collection_placeholders ?? {},
  };

  let publishResponse: Response;
  try {
    publishResponse = await fetchWithRetry(publishUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(publishBody),
    });
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
    spinner2.fail("Access denied publishing manifest. The service key needs cms:templates:write scope.");
    return 1;
  }
  if (publishResponse.status === 422) {
    spinner2.fail("Manifest validation failed — required values missing on one or more sections.");
    try {
      const errBody = JSON.parse(publishText) as { detail?: { errors?: Array<{ location: string; section_type: string; attribute: string; code: string; message: string }> } };
      const errors = errBody?.detail?.errors ?? [];
      if (errors.length > 0) {
        console.log("");
        for (const e of errors) {
          console.log(`  ${pc.red("✗")} ${pc.dim(e.location)}`);
          console.log(`    ${pc.bold(e.section_type)}.${e.attribute} — ${e.message}`);
        }
        console.log("");
        console.log(sym.hint("Fill the missing values in proxima.website.json and re-run."));
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

  let publishedBody: { manifest_s3_key?: string; manifest_s3_version_id?: string | null; sections_validated?: number } = {};
  try { publishedBody = JSON.parse(publishText); } catch { /* ignore */ }

  const pageCount = manifest.pages.length;
  const shellCount = (manifest.shell_sections ?? []).length;
  const placeholderCount = Object.keys(manifest.smart_collection_placeholders ?? {}).length;
  const sectionsValidated = publishedBody.sections_validated ?? (pageCount + shellCount);

  spinner2.succeed(`Manifest published ${pc.dim(elapsed2 + "s")} ${pc.dim(`(${sectionsValidated} section(s) validated)`)}`);
  console.log(sym.hint(`Pages: ${pageCount}  ·  Shell sections: ${shellCount}  ·  Smart collection placeholders: ${placeholderCount}`));
  if (publishedBody.manifest_s3_key) {
    console.log(sym.hint(`Manifest: ${pc.cyan(publishedBody.manifest_s3_key)} ${pc.dim(`VersionId=${publishedBody.manifest_s3_version_id ?? "null"}`)}`));
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

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp(unknownCommand?: string) {
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
