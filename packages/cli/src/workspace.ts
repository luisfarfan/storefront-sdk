import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface StorefrontWorkspace {
  slug: string;
  appPath: string;
  relativePath: string;
  domain: string | null;
  port: number | null;
  templateKey: string | null;
  hasManifest: boolean;
  hasCredentials: boolean;
  hasEnv: boolean;
}

export interface MonorepoContext {
  root: string;
  workspaces: StorefrontWorkspace[];
}

const MANIFEST_NAME = "proxima.website.json";
const APP_DIR_NAMES = ["apps", "templates", "sites"] as const;

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseEnvValue(content: string, key: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value || null;
  }
  return null;
}

function readEnvDomain(appPath: string): string | null {
  for (const fileName of [".env", ".env.example"]) {
    const envPath = path.join(appPath, fileName);
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, "utf8");
    const domain =
      parseEnvValue(content, "PROXIMA_WEBSITE_DOMAIN") ??
      parseEnvValue(content, "PROXIMA_DOMAIN");
    if (domain) return domain;
  }
  return null;
}

function readCredentials(appPath: string): { domain?: string; template_key?: string } | null {
  const credPath = path.join(appPath, ".proxima", "credentials.json");
  if (!existsSync(credPath)) return null;
  const json = readJsonFile(credPath);
  if (!json) return null;
  return {
    domain: typeof json.domain === "string" ? json.domain : undefined,
    template_key: typeof json.template_key === "string" ? json.template_key : undefined,
  };
}

function readTemplateKeyFromManifest(appPath: string): string | null {
  const manifest = readJsonFile(path.join(appPath, MANIFEST_NAME));
  if (!manifest) return null;
  const meta = manifest.marketplace_metadata;
  if (meta && typeof meta === "object" && meta !== null) {
    const record = meta as Record<string, unknown>;
    if (typeof record.template_key === "string") return record.template_key;
  }
  if (typeof manifest.template_key === "string") return manifest.template_key;
  return null;
}

function readPortFromPackageJson(appPath: string): number | null {
  const pkg = readJsonFile(path.join(appPath, "package.json"));
  if (!pkg || typeof pkg.scripts !== "object" || pkg.scripts === null) return null;
  const scripts = pkg.scripts as Record<string, string>;
  for (const script of Object.values(scripts)) {
    const match = script.match(/--port(?:=|\s+)(\d+)/);
    if (match) return Number(match[1]);
  }
  return null;
}

function isStorefrontAppDir(dirPath: string): boolean {
  return existsSync(path.join(dirPath, MANIFEST_NAME));
}

function collectFromParent(parentDir: string, root: string): StorefrontWorkspace[] {
  if (!existsSync(parentDir)) return [];
  const entries = readdirSync(parentDir, { withFileTypes: true });
  const workspaces: StorefrontWorkspace[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const appPath = path.join(parentDir, entry.name);
    if (!isStorefrontAppDir(appPath)) continue;

    const credentials = readCredentials(appPath);
    const domain = credentials?.domain ?? readEnvDomain(appPath);
    const templateKey =
      credentials?.template_key ??
      readTemplateKeyFromManifest(appPath) ??
      entry.name;

    workspaces.push({
      slug: entry.name,
      appPath,
      relativePath: path.relative(root, appPath),
      domain,
      port: readPortFromPackageJson(appPath),
      templateKey,
      hasManifest: true,
      hasCredentials: credentials !== null,
      hasEnv: existsSync(path.join(appPath, ".env")),
    });
  }

  return workspaces.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function findMonorepoRoot(startDir = process.cwd()): string | null {
  let current = path.resolve(startDir);
  const { root } = path.parse(current);

  while (true) {
    for (const dirName of APP_DIR_NAMES) {
      const parent = path.join(current, dirName);
      if (!existsSync(parent)) continue;
      const hasManifestChild = readdirSync(parent, { withFileTypes: true }).some(
        (entry) => entry.isDirectory() && isStorefrontAppDir(path.join(parent, entry.name)),
      );
      if (hasManifestChild) return current;
    }

    if (current === root) break;
    current = path.dirname(current);
  }

  return null;
}

export function discoverWorkspaces(startDir = process.cwd()): MonorepoContext | null {
  const resolvedStart = path.resolve(startDir);

  if (isStorefrontAppDir(resolvedStart)) {
    const root = path.dirname(resolvedStart);
    const slug = path.basename(resolvedStart);
    const credentials = readCredentials(resolvedStart);
    return {
      root,
      workspaces: [
        {
          slug,
          appPath: resolvedStart,
          relativePath: slug,
          domain: credentials?.domain ?? readEnvDomain(resolvedStart),
          port: readPortFromPackageJson(resolvedStart),
          templateKey:
            credentials?.template_key ??
            readTemplateKeyFromManifest(resolvedStart) ??
            slug,
          hasManifest: true,
          hasCredentials: credentials !== null,
          hasEnv: existsSync(path.join(resolvedStart, ".env")),
        },
      ],
    };
  }

  const root = findMonorepoRoot(resolvedStart);
  if (!root) return null;

  const workspaces: StorefrontWorkspace[] = [];
  for (const dirName of APP_DIR_NAMES) {
    workspaces.push(...collectFromParent(path.join(root, dirName), root));
  }

  const unique = new Map<string, StorefrontWorkspace>();
  for (const workspace of workspaces) {
    unique.set(workspace.slug, workspace);
  }

  return {
    root,
    workspaces: [...unique.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

export function resolveWorkspaceTarget(
  slugOrPath: string | undefined,
  startDir = process.cwd(),
): StorefrontWorkspace {
  const context = discoverWorkspaces(startDir);

  if (slugOrPath) {
    if (slugOrPath.includes(path.sep) || slugOrPath.startsWith(".")) {
      const appPath = path.resolve(startDir, slugOrPath);
      if (!isStorefrontAppDir(appPath)) {
        throw new Error(`No proxima.website.json found at ${appPath}`);
      }
      const slug = path.basename(appPath);
      const credentials = readCredentials(appPath);
      return {
        slug,
        appPath,
        relativePath: slugOrPath,
        domain: credentials?.domain ?? readEnvDomain(appPath),
        port: readPortFromPackageJson(appPath),
        templateKey:
          credentials?.template_key ?? readTemplateKeyFromManifest(appPath) ?? slug,
        hasManifest: true,
        hasCredentials: credentials !== null,
        hasEnv: existsSync(path.join(appPath, ".env")),
      };
    }

    if (context) {
      const match = context.workspaces.find((w) => w.slug === slugOrPath);
      if (match) return match;
    }

    const candidatePaths = APP_DIR_NAMES.map((dir) =>
      path.resolve(startDir, dir, slugOrPath),
    );
    for (const appPath of candidatePaths) {
      if (isStorefrontAppDir(appPath)) {
        return resolveWorkspaceTarget(appPath, startDir);
      }
    }

    throw new Error(
      `Unknown storefront "${slugOrPath}". Run \`proxima list\` to see available workspaces.`,
    );
  }

  if (isStorefrontAppDir(startDir)) {
    return resolveWorkspaceTarget(".", startDir);
  }

  if (context && context.workspaces.length === 1) {
    return context.workspaces[0]!;
  }

  throw new Error(
    "Missing storefront slug. Usage: proxima <command> <slug>  (run `proxima list` to see options)",
  );
}

export function readCaddyHosts(caddyfilePath: string): Set<string> {
  const hosts = new Set<string>();
  if (!existsSync(caddyfilePath)) return hosts;

  const content = readFileSync(caddyfilePath, "utf8");
  for (const match of content.matchAll(/^https?:\/\/([^\s{]+)/gm)) {
    hosts.add(match[1]!);
  }
  return hosts;
}

export interface CaddyCheckResult {
  caddyfilePath: string;
  missing: StorefrontWorkspace[];
  configured: StorefrontWorkspace[];
  catchAll: boolean;
}

export function checkCaddyRoutes(monorepoRoot: string): CaddyCheckResult {
  const context = discoverWorkspaces(monorepoRoot);
  const caddyfilePath = path.join(monorepoRoot, "Caddyfile");
  const hosts = readCaddyHosts(caddyfilePath);
  const catchAll = [...hosts].some((host) => host.startsWith("*."));
  const missing: StorefrontWorkspace[] = [];
  const configured: StorefrontWorkspace[] = [];

  for (const workspace of context?.workspaces ?? []) {
    if (!workspace.domain) continue;
    if (hosts.has(workspace.domain) || catchAll) {
      configured.push(workspace);
    } else {
      missing.push(workspace);
    }
  }

  return { caddyfilePath, missing, configured, catchAll };
}

export function formatWorkspaceTable(workspaces: StorefrontWorkspace[]): string {
  if (workspaces.length === 0) {
    return "No storefront workspaces found (expected apps/*/proxima.website.json).";
  }

  const headers = ["SLUG", "DOMAIN", "PORT", "CREDS", "PATH"];
  const rows = workspaces.map((w) => [
    w.slug,
    w.domain ?? "—",
    w.port?.toString() ?? "—",
    w.hasCredentials ? "✓" : "—",
    w.relativePath,
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]!.length)),
  );

  const formatRow = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index]!)).join("  ");

  return [formatRow(headers), formatRow(widths.map((w) => "─".repeat(w))), ...rows.map(formatRow)].join(
    "\n",
  );
}
