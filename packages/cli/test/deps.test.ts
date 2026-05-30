import { describe, expect, it } from "vitest";

describe("published dependency chain", () => {
  it("templateizer loads (registry-client exports WebsiteDeployClient)", async () => {
    const { run } = await import("@proxima-io/templateizer");
    expect(run).toBeTypeOf("function");
    const code = await run([]);
    expect(code).toBe(0);
  });
});
