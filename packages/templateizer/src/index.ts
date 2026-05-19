#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TemplateRegistryClient, type WebsiteTemplateRecord } from "@proxima/template-registry-client";
import { parseTemplateManifest, validateTemplateManifest, type TemplateManifest } from "@proxima/template-schema";

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
  if (command === "preview") {
    console.log("Run preview with: pnpm --filter @proxima/catalog-preview dev");
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

Options:
  --dry-run         Print planned action without calling the API.
  --api-url         Override PROXIMA_API_URL.
  --token           Override PROXIMA_API_TOKEN.
  --publish         Publish during sync.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((code) => {
    process.exitCode = code;
  });
}
