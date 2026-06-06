import { cancel, confirm, password, text, isCancel } from '@clack/prompts';
import { isCI } from './is-ci.js';

export async function promptText(question: string, defaultValue?: string): Promise<string> {
  if (isCI) return defaultValue ?? '';
  const result = await text({
    message: question,
    placeholder: defaultValue,
    defaultValue,
  });
  if (isCancel(result)) { cancel('Setup cancelled.'); process.exit(0); }
  return (result as string) || defaultValue || '';
}

export async function promptHidden(question: string): Promise<string> {
  if (isCI) return '';
  const result = await password({ message: question });
  if (isCancel(result)) { cancel('Setup cancelled.'); process.exit(0); }
  return result as string;
}

export async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  if (isCI) return defaultYes;
  const result = await confirm({ message: question, initialValue: defaultYes });
  if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
  return result as boolean;
}
