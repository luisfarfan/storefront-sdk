import { describe, expect, it } from "vitest";
import { redactToken, TemplateRegistryClient, RegistryClientError } from "../src/index.js";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("TemplateRegistryClient", () => {
  it("finds template by template_key before slug", async () => {
    const fetchImpl = async () =>
      jsonResponse([
        { id: "slug-only", slug: "demo", template_key: "old" },
        { id: "by-key", slug: "other", template_key: "demo" },
      ]);
    const client = new TemplateRegistryClient({ apiUrl: "http://api.test/", token: "token", fetchImpl: fetchImpl as any });

    await expect(client.findTemplate({ templateKey: "demo", slug: "demo" })).resolves.toMatchObject({ id: "by-key" });
  });

  it("sends bearer auth without exposing token in thrown response text", async () => {
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: "Bearer secret-token" });
      return new Response("bad secret-token", { status: 401 });
    };
    const client = new TemplateRegistryClient({ apiUrl: "http://api.test", token: "secret-token", fetchImpl: fetchImpl as any });

    await expect(client.listAdminTemplates()).rejects.toMatchObject({
      name: "RegistryClientError",
      status: 401,
      responseText: "bad [REDACTED]",
    });
  });

  it("redacts token occurrences", () => {
    expect(redactToken("abc token abc token", "token")).toBe("abc [REDACTED] abc [REDACTED]");
  });

  it("requires api url and token", () => {
    expect(() => new TemplateRegistryClient({ apiUrl: "", token: "x" })).toThrow(RegistryClientError);
    expect(() => new TemplateRegistryClient({ apiUrl: "http://api.test", token: "" })).toThrow(RegistryClientError);
  });
});
