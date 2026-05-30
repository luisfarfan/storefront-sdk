import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverWorkspaces,
  findMonorepoRoot,
  formatWorkspaceTable,
  resolveWorkspaceTarget,
} from "../src/workspace.js";

const STOREFRONTS_ROOT = path.resolve(
  import.meta.dirname,
  "../../../../proxima-storefronts",
);

describe("workspace discovery", () => {
  it("finds proxima-storefronts monorepo root", () => {
    const root = findMonorepoRoot(path.join(STOREFRONTS_ROOT, "apps/214store"));
    expect(root).toBe(STOREFRONTS_ROOT);
  });

  it("lists known storefront apps", () => {
    const context = discoverWorkspaces(STOREFRONTS_ROOT);
    expect(context).not.toBeNull();
    const slugs = context!.workspaces.map((w) => w.slug);
    expect(slugs).toContain("214store");
    expect(slugs).toContain("nocturna");
    expect(slugs).not.toContain("devhub");
  });

  it("resolves slug to app path", () => {
    const workspace = resolveWorkspaceTarget("214store", STOREFRONTS_ROOT);
    expect(workspace.appPath).toBe(path.join(STOREFRONTS_ROOT, "apps/214store"));
    expect(workspace.hasManifest).toBe(true);
  });

  it("formats a workspace table", () => {
    const context = discoverWorkspaces(STOREFRONTS_ROOT);
    const table = formatWorkspaceTable(context!.workspaces);
    expect(table).toContain("SLUG");
    expect(table).toContain("214store");
  });
});

describe("isolated workspace fixture", () => {
  let tempRoot = "";

  afterEach(() => {
    tempRoot = "";
  });

  it("discovers a single synthetic app", () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "proxima-cli-"));
    const appPath = path.join(tempRoot, "apps", "demo-store");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(path.join(appPath, "proxima.website.json"), '{"schema_version":"1.0"}');
    writeFileSync(
      path.join(appPath, "package.json"),
      JSON.stringify({ scripts: { dev: "astro dev --port 4999" } }),
    );
    writeFileSync(path.join(appPath, ".env.example"), "PROXIMA_WEBSITE_DOMAIN=demo.localhost\n");

    const context = discoverWorkspaces(tempRoot);
    expect(context?.workspaces).toHaveLength(1);
    expect(context?.workspaces[0]?.slug).toBe("demo-store");
    expect(context?.workspaces[0]?.port).toBe(4999);
    expect(context?.workspaces[0]?.domain).toBe("demo.localhost");
  });
});
