import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatSkillsList,
  getBundledSkillsDir,
  installSkills,
  listBundledSkills,
} from "../src/skills.js";

describe("skills", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("bundled skills directory exists with website-deploy", () => {
    const dir = getBundledSkillsDir();
    const skills = listBundledSkills(dir);
    expect(skills.some((s) => s.name === "website-deploy")).toBe(true);
    expect(readFileSync(join(dir, "website-deploy", "SKILL.md"), "utf8")).toContain("proxima deploy");
  });

  it("installs skills into project .cursor and .claude", () => {
    const cwd = mkdtempSync(join(tmpdir(), "proxima-skills-"));
    tempDirs.push(cwd);

    const result = installSkills({
      cwd,
      targets: ["cursor", "claude"],
      skillNames: ["website-deploy"],
    });

    expect(result.installed.length).toBe(2);
    expect(readFileSync(join(cwd, ".cursor", "skills", "website-deploy", "SKILL.md"), "utf8")).toContain(
      "website-deploy",
    );
    expect(readFileSync(join(cwd, ".claude", "skills", "website-deploy", "SKILL.md"), "utf8")).toContain(
      "website-deploy",
    );
  });

  it("skips existing installs unless force", () => {
    const cwd = mkdtempSync(join(tmpdir(), "proxima-skills-"));
    tempDirs.push(cwd);
    mkdirSync(join(cwd, ".cursor", "skills", "website-deploy"), { recursive: true });
    writeFileSync(join(cwd, ".cursor", "skills", "website-deploy", "SKILL.md"), "old");

    const skipped = installSkills({
      cwd,
      targets: ["cursor"],
      skillNames: ["website-deploy"],
    });
    expect(skipped.skipped.length).toBe(1);
    expect(readFileSync(join(cwd, ".cursor", "skills", "website-deploy", "SKILL.md"), "utf8")).toBe(
      "old",
    );

    installSkills({
      cwd,
      targets: ["cursor"],
      skillNames: ["website-deploy"],
      force: true,
    });
    expect(readFileSync(join(cwd, ".cursor", "skills", "website-deploy", "SKILL.md"), "utf8")).toContain(
      "website-deploy",
    );
  });

  it("formatSkillsList includes install hint", () => {
    const text = formatSkillsList([{ name: "add-section", description: "Add a CMS section" }]);
    expect(text).toContain("add-section");
    expect(text).toContain("proxima skills install");
  });
});
