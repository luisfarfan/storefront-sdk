import { run as templateizerRun } from "@proxima-io/templateizer";
import { createInterface } from "node:readline";
import { printHelp } from "./help.js";
import {
  checkCaddyRoutes,
  discoverWorkspaces,
  formatWorkspaceTable,
  resolveWorkspaceTarget,
} from "./workspace.js";

const TEMPLATEIZER_COMMANDS = new Set([
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

const ALIASES: Record<string, string[]> = {
  deploy: ["website-deploy"],
  "template:create": ["template-create"],
  "template:publish": ["template-create", "--publish-manifest"],
};

const isCI = Boolean(
  process.env.CI || process.env.GITHUB_ACTIONS || process.env.NO_INTERACTIVE || !process.stdin.isTTY,
);

function isFlag(token: string): boolean {
  return token.startsWith("-");
}

async function promptSelect<T extends { slug: string }>(
  question: string,
  options: T[],
): Promise<T> {
  if (options.length === 0) {
    throw new Error("No storefront workspaces available.");
  }
  if (options.length === 1) return options[0]!;

  console.log(question);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option.slug}`);
  });

  if (isCI) {
    throw new Error("Multiple storefronts found — pass a slug explicitly.");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("Select number: ", resolve);
  });
  rl.close();

  const selected = Number.parseInt(answer.trim(), 10);
  if (!Number.isFinite(selected) || selected < 1 || selected > options.length) {
    throw new Error(`Invalid selection: ${answer}`);
  }
  return options[selected - 1]!;
}

function splitArgs(argv: string[]): { command: string; rest: string[] } {
  const [command = "", ...rest] = argv;
  return { command, rest };
}

function extractTarget(rest: string[]): { target?: string; flags: string[] } {
  if (rest.length === 0 || isFlag(rest[0]!)) {
    return { flags: rest };
  }
  return { target: rest[0], flags: rest.slice(1) };
}

async function resolveTargetArg(target: string | undefined): Promise<string> {
  if (target) {
    const workspace = resolveWorkspaceTarget(target);
    return workspace.appPath;
  }

  const context = discoverWorkspaces();
  if (context && context.workspaces.length > 1) {
    const selected = await promptSelect("Multiple storefronts found:", context.workspaces);
    return selected.appPath;
  }

  const workspace = resolveWorkspaceTarget(undefined);
  return workspace.appPath;
}

async function runList(): Promise<number> {
  const context = discoverWorkspaces();
  if (!context || context.workspaces.length === 0) {
    console.log("No storefront workspaces found.");
    console.log("Expected apps/*/proxima.website.json under a monorepo root.");
    return 1;
  }

  console.log(`Monorepo: ${context.root}\n`);
  console.log(formatWorkspaceTable(context.workspaces));
  return 0;
}

async function runCaddyCheck(): Promise<number> {
  const context = discoverWorkspaces();
  if (!context) {
    console.error("✗ Could not detect monorepo root.");
    return 1;
  }

  const result = checkCaddyRoutes(context.root);
  console.log(`Caddyfile: ${result.caddyfilePath}\n`);

  if (result.configured.length > 0) {
    console.log("Configured:");
    for (const workspace of result.configured) {
      console.log(`  ✓ ${workspace.domain} → ${workspace.slug}`);
    }
    console.log("");
  }

  if (result.catchAll) {
    console.log("Catch-all route detected (*.localhost) — extra domains may still work.\n");
  }

  if (result.missing.length === 0) {
    console.log("✓ All known storefront domains are covered.");
    return 0;
  }

  console.log("Missing explicit routes:");
  for (const workspace of result.missing) {
    const port = workspace.port ?? 4321;
    console.log(`  ✗ ${workspace.domain} (${workspace.slug})`);
    console.log(`    http://${workspace.domain} {`);
    console.log(`      reverse_proxy localhost:${port}`);
    console.log(`    }`);
  }
  return 1;
}

async function delegateTemplateizer(
  templateizerCommand: string,
  target: string | undefined,
  flags: string[],
): Promise<number> {
  const appPath = await resolveTargetArg(target);
  return templateizerRun([templateizerCommand, appPath, ...flags]);
}

export async function run(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return 0;
  }

  const { command, rest } = splitArgs(argv);

  if (command === "list") {
    return runList();
  }

  if (command === "caddy") {
    const [subcommand] = rest;
    if (subcommand === "check") {
      return runCaddyCheck();
    }
    console.error(`Unknown caddy subcommand: ${subcommand ?? "(none)"}`);
    return 1;
  }

  const alias = ALIASES[command];
  if (alias) {
    const [templateizerCommand, ...aliasFlags] = alias;
    const { target, flags } = extractTarget(rest);
    return delegateTemplateizer(templateizerCommand!, target, [...aliasFlags, ...flags]);
  }

  if (TEMPLATEIZER_COMMANDS.has(command)) {
    const { target, flags } = extractTarget(rest);
    return delegateTemplateizer(command, target, flags);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}
