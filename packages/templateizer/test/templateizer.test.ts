import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildArtifacts, run, validateTarget } from "../src/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  delete process.env.PROXIMA_API_URL;
  delete process.env.PROXIMA_API_TOKEN;
});

describe("templateizer", () => {
  it("discovers Astro pages and writes inferred artifacts", () => {
    const root = mkdtempSync(path.join(tmpdir(), "proxima-templateizer-"));
    mkdirSync(path.join(root, "src", "pages"), { recursive: true });
    mkdirSync(path.join(root, "src", "pages", "producto"), { recursive: true });
    writeFileSync(path.join(root, "src", "pages", "index.astro"), "<h1>Home</h1>");
    writeFileSync(path.join(root, "src", "pages", "producto", "[slug].astro"), "<h1>Product</h1>", { flag: "w" });

    const artifacts = buildArtifacts(root, "scan");
    expect(JSON.stringify(artifacts["pages.json"])).toContain("/");
    expect(JSON.stringify(artifacts["pages.json"])).toContain("/producto/{slug}");
  });

  it("validates a manifest target", () => {
    const root = mkdtempSync(path.join(tmpdir(), "proxima-manifest-"));
    const manifestPath = path.join(root, "proxima.template.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        template_key: "demo",
        name: "Demo",
        slug: "demo",
        category: "commerce",
        repository_config: {},
        deployment_config: {},
        section_types: [
          {
            key: "hero",
            label: "Hero",
            renderer: "Hero",
            attribute_schema: [{ name: "heading", type: "text", config: {} }],
          },
        ],
        pages: [{ name: "Home", path: "/", sections: [{ name: "Hero", type: "hero", values: {} }] }],
      }),
    );

    expect(validateTarget(root)).toBe(0);
    expect(readFileSync(manifestPath, "utf8")).toContain("template_key");
  });

  it("prints register dry run payload without calling API", async () => {
    const root = createManifestFixture();
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn() as any;

    await expect(run(["register", root, "--dry-run"])).resolves.toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(spy.mock.calls.map((call) => call.join(" ")).join("\n")).toContain('"action": "register"');
  });

  it("registers with POST when template does not exist", async () => {
    const root = createManifestFixture();
    process.env.PROXIMA_API_URL = "http://api.test";
    process.env.PROXIMA_API_TOKEN = "token";
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/api/v1/admin/cms/website-templates") && init?.method !== "POST") {
        return new Response("[]", { status: 200 });
      }
      return new Response(JSON.stringify({ id: "created", template_key: "demo", publication_status: "draft" }), { status: 200 });
    }) as any;
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(run(["register", root])).resolves.toBe(0);
    expect(calls.some((call) => call.init?.method === "POST")).toBe(true);
  });

  it("registers with PATCH when template already exists", async () => {
    const root = createManifestFixture();
    process.env.PROXIMA_API_URL = "http://api.test";
    process.env.PROXIMA_API_TOKEN = "token";
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/api/v1/admin/cms/website-templates") && init?.method !== "PATCH") {
        return new Response(JSON.stringify([{ id: "existing", template_key: "demo", slug: "demo" }]), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "existing", template_key: "demo", publication_status: "draft" }), { status: 200 });
    }) as any;
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(run(["register", root])).resolves.toBe(0);
    expect(calls.some((call) => call.url.endsWith("/existing") && call.init?.method === "PATCH")).toBe(true);
  });
});

function createManifestFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "proxima-registry-"));
  writeFileSync(
    path.join(root, "proxima.template.json"),
    JSON.stringify({
      template_key: "demo",
      name: "Demo",
      slug: "demo",
      category: "commerce",
      repository_config: {},
      deployment_config: {},
      section_types: [
        {
          key: "hero",
          label: "Hero",
          renderer: "Hero",
          attribute_schema: [{ name: "heading", type: "text", config: {} }],
        },
      ],
      pages: [{ name: "Home", path: "/", sections: [{ name: "Hero", type: "hero", values: {} }] }],
    }),
  );
  return root;
}
