#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifacts } from './artifacts/build-artifacts.js';
import { validateTarget } from './artifacts/validate-target.js';
import { printHelp } from './cli/help.js';
import { dispatchCommand, isKnownCommand } from './cli/registry.js';

export async function run(argv = process.argv.slice(2)): Promise<number> {
  if (argv[0] === '--') {
    argv = argv.slice(1);
  }
  const [command, target = '.'] = argv;
  if (!command || !isKnownCommand(command)) {
    printHelp(command);
    return command ? 1 : 0;
  }

  const targetPath = path.resolve(process.cwd(), target);
  return dispatchCommand(command, targetPath, argv.slice(2));
}

export { buildArtifacts, validateTarget };

function isCliEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fileURLToPath(import.meta.url) === path.resolve(entry);
  } catch {
    return false;
  }
}

if (isCliEntrypoint()) {
  run().then((code) => {
    process.exitCode = code;
  });
}
