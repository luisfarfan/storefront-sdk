import type { CommandHandler } from './types.js';
import { runArtifactCommand } from '../artifacts/build-artifacts.js';
import { validateTarget } from '../artifacts/validate-target.js';
import { initCommand } from '../commands/init.js';
import { previewCommand } from '../commands/preview.js';
import {
  deployTemplateCommand,
  publishTemplateCommand,
  registerTemplateCommand,
  statusTemplateCommand,
  syncTemplateCommand,
} from '../commands/registry.js';
import { templateCreateCommand, templatePublishCommand } from '../commands/template-create.js';
import { templateDeployCommand } from '../commands/template-deploy.js';
import { websiteDeployCommand } from '../commands/website-deploy.js';

export const ARTIFACT_COMMANDS = new Set([
  'scan',
  'snapshot',
  'analyze',
  'infer-schema',
  'infer-collections',
  'codemod',
]);

export const COMMAND_NAMES = new Set([
  'init',
  ...ARTIFACT_COMMANDS,
  'validate',
  'preview',
  'register',
  'deploy',
  'publish',
  'sync',
  'status',
  'website-deploy',
  'template-deploy',
  'template-create',
  'template-publish',
]);

const handlers: Record<string, CommandHandler> = {
  init: initCommand,
  validate: (targetPath) => Promise.resolve(validateTarget(targetPath)),
  preview: previewCommand,
  register: registerTemplateCommand,
  deploy: deployTemplateCommand,
  publish: publishTemplateCommand,
  sync: syncTemplateCommand,
  status: statusTemplateCommand,
  'website-deploy': websiteDeployCommand,
  'template-deploy': templateDeployCommand,
  'template-create': templateCreateCommand,
  'template-publish': templatePublishCommand,
};

export function isKnownCommand(command: string): boolean {
  return COMMAND_NAMES.has(command);
}

export function isArtifactCommand(command: string): boolean {
  return ARTIFACT_COMMANDS.has(command);
}

export async function dispatchCommand(command: string, targetPath: string, argv: string[]): Promise<number> {
  if (isArtifactCommand(command)) {
    return runArtifactCommand(targetPath, command);
  }
  const handler = handlers[command];
  if (!handler) {
    throw new Error(`No handler registered for command: ${command}`);
  }
  return handler(targetPath, argv);
}
