import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkCaddyRoutes,
  discoverWorkspaces,
  findMonorepoRoot,
  formatWorkspaceTable,
  resolveWorkspaceTarget,
} from "../src/workspace.js";

function scaffoldMonorepo(root: string, apps: Array<{ slug: string; port: number; domain: string }>) {
  for (const app of apps) {
    const appPath = path.join(root, "apps", app.slug);
    mkdirSync(appPath, { recursive: true });
    writeFileSync(path.join(appPath, "proxima.website.json"), '{"schema_version":"1.0"}');
    writeFileSync(
      path.join(appPath, "package.json"),
      JSON.stringify({ scripts: { dev: `astro dev --port ${app.port}` } }),
    );
    writeFileSync(path.join(appPath, ".env.example"), `PROXIMA_WEBSITE_DOMAIN=${app.domain}\n`);
  }
}

describe("workspace discovery", () => {
  let tempRoot = "";

  afterEach(() => {
    tempRoot = "";
  });

  it("finds monorepo root from an app directory", () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "proxima-cli-"));
    scaffoldMonorepo(tempRoot, [{ slug: "214store", port: 4325, domain: "214store.localhost" }]);

    const root = findMonorepoRoot(path.join(tempRoot, "apps/214store"));
    expect(root).toBe(tempRoot);
  });

  it("lists storefront apps under apps/", () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "proxima-cli-"));
    scaffoldMonorepo(tempRoot, [
      { slug: "214store", port: 4325, domain: "214store.localhost" },
      { slug: "nocturna", port: 4326, domain: "nocturna.localhost" },
    ]);

    const context = discoverWorkspaces(tempRoot);
    expect(context).not.toBeNull();
    const slugs = context!.workspaces.map((w) => w.slug);
    expect(slugs).toEqual(["214store", "nocturna"]);
  });

  it("resolves slug to app path", () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "proxima-cli-"));
    scaffoldMonorepo(tempRoot, [{ slug: "214store", port: 4325, domain: "214store.localhost" }]);

    const workspace = resolveWorkspaceTarget("214store", tempRoot);
    expect(workspace.appPath).toBe(path.join(tempRoot, "apps/214store"));
    expect(workspace.domain).toBe("214store.localhost");
  });

  it("formats a workspace table", () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "proxima-cli-"));
    scaffoldMonorepo(tempRoot, [{ slug: "214store", port: 4325, domain: "214store.localhost" }]);

    const context = discoverWorkspaces(tempRoot);
    const table = formatWorkspaceTable(context!.workspaces);
    expect(table).toContain("SLUG");
    expect(table).toContain("214store");
  });

  it("reports missing Caddy routes", () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "proxima-cli-"));
    scaffoldMonorepo(tempRoot, [{ slug: "demo", port: 4999, domain: "demo.localhost" }]);
    writeFileSync(path.join(tempRoot, "Caddyfile"), "http://214store.localhost {\n  reverse_proxy localhost:4325\n}\n");

    const result = checkCaddyRoutes(tempRoot);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]?.slug).toBe("demo");
  });
});
