import pc from 'picocolors';
import { validateTemplateManifest } from '@proxima-io/template-schema';
import { readJson } from '../internal/fs.js';
import { collectTemplateManifestPaths } from '../manifest/template.js';
import { sym } from '../ui/sym.js';

export function validateTarget(targetPath: string): number {
  const manifests = collectTemplateManifestPaths(targetPath);
  if (!manifests.length) {
    console.error(sym.err(`No proxima.template.json files found under ${pc.dim(targetPath)}`));
    return 1;
  }

  let failed = false;
  for (const manifestPath of manifests) {
    const value = readJson(manifestPath);
    const result = validateTemplateManifest(value);
    if (!result.success) {
      failed = true;
      console.error(sym.err(`Invalid manifest: ${pc.cyan(manifestPath)}`));
      for (const issue of result.error.issues) {
        console.error(sym.hint(`${issue.path.join('.') || '(root)'}: ${issue.message}`));
      }
    } else {
      console.log(sym.ok(`Valid manifest: ${pc.cyan(manifestPath)}`));
    }
  }
  return failed ? 1 : 0;
}
