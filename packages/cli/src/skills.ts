import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillTarget = "cursor" | "claude";

export interface InstallSkillsOptions {
  cwd?: string;
  global?: boolean;
  targets?: SkillTarget[];
  force?: boolean;
  skillNames?: string[];
}

export interface SkillInfo {
  name: string;
  description: string;
}

/** Directory bundled with @proxima-io/cli (packages/cli/skills). */
export function getBundledSkillsDir(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return join(here, "..", "skills");
}

function readDescription(skillMdPath: string): string {
  try {
    const raw = readFileSync(skillMdPath, "utf8");
    const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter) return "";
    const block = frontmatter[1] ?? "";
    const single = block.match(/^description:\s*(.+)$/m);
    if (single?.[1]) return single[1].trim();
    const multiline = block.match(/^description:\s*>\s*\n((?:\s+.+\n?)+)/m);
    if (multiline?.[1]) {
      return multiline[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function listBundledSkills(skillsDir = getBundledSkillsDir()): SkillInfo[] {
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir)
    .filter((entry) => {
      const skillPath = join(skillsDir, entry);
      return statSync(skillPath).isDirectory() && existsSync(join(skillPath, "SKILL.md"));
    })
    .map((name) => ({
      name,
      description: readDescription(join(skillsDir, name, "SKILL.md")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function destinationRoots(cwd: string, global: boolean, targets: SkillTarget[]): string[] {
  const roots: string[] = [];
  for (const target of targets) {
    if (global) {
      roots.push(
        target === "cursor"
          ? join(homedir(), ".cursor", "skills")
          : join(homedir(), ".claude", "skills"),
      );
    } else {
      roots.push(
        target === "cursor"
          ? join(cwd, ".cursor", "skills")
          : join(cwd, ".claude", "skills"),
      );
    }
  }
  return roots;
}

export interface InstallSkillsResult {
  installed: Array<{ skill: string; dest: string }>;
  skipped: Array<{ skill: string; dest: string; reason: string }>;
}

export function installSkills(options: InstallSkillsOptions = {}): InstallSkillsResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const global = options.global ?? false;
  const targets = options.targets ?? (["cursor", "claude"] as SkillTarget[]);
  const force = options.force ?? false;
  const skillsDir = getBundledSkillsDir();
  const available = listBundledSkills(skillsDir);

  if (available.length === 0) {
    throw new Error(`No bundled skills found at ${skillsDir}`);
  }

  const selected =
    options.skillNames && options.skillNames.length > 0
      ? options.skillNames
      : available.map((s) => s.name);

  for (const name of selected) {
    if (!available.some((s) => s.name === name)) {
      throw new Error(`Unknown skill: ${name}. Run \`proxima skills list\` for available skills.`);
    }
  }

  const result: InstallSkillsResult = { installed: [], skipped: [] };

  for (const root of destinationRoots(cwd, global, targets)) {
    mkdirSync(root, { recursive: true });
    for (const name of selected) {
      const src = join(skillsDir, name);
      const dest = join(root, name);
      if (existsSync(dest) && !force) {
        result.skipped.push({ skill: name, dest, reason: "already exists (use --force)" });
        continue;
      }
      cpSync(src, dest, { recursive: true, force: true });
      result.installed.push({ skill: name, dest });
    }
  }

  return result;
}

export function formatSkillsList(skills: SkillInfo[]): string {
  if (skills.length === 0) return "No skills bundled.";
  const lines = ["Bundled Proxima agent skills:\n"];
  for (const skill of skills) {
    lines.push(`  ${skill.name}`);
    if (skill.description) {
      const preview =
        skill.description.length > 120 ? `${skill.description.slice(0, 120)}…` : skill.description;
      lines.push(`    ${preview}`);
    }
  }
  lines.push("\nInstall: proxima skills install [--cursor|--claude] [--global] [--force] [skill...]");
  return lines.join("\n");
}

export function parseSkillsInstallFlags(argv: string[]): {
  flags: string[];
  skillNames: string[];
  global: boolean;
  force: boolean;
  targets: SkillTarget[];
} {
  const skillNames: string[] = [];
  let global = false;
  let force = false;
  let cursor = false;
  let claude = false;

  for (const arg of argv) {
    if (arg === "--global" || arg === "-g") global = true;
    else if (arg === "--force" || arg === "-f") force = true;
    else if (arg === "--cursor") cursor = true;
    else if (arg === "--claude") claude = true;
    else if (!arg.startsWith("-")) skillNames.push(arg);
  }

  const targets: SkillTarget[] =
    cursor || claude
      ? ([cursor && "cursor", claude && "claude"].filter(Boolean) as SkillTarget[])
      : (["cursor", "claude"] as SkillTarget[]);

  return { flags: argv, skillNames, global, force, targets };
}
