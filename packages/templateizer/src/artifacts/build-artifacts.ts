import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { discoverPages, findFiles, readJson } from '../internal/fs.js';
import type { JsonRecord } from '../types/json.js';
import { findManifestPath, safeManifest } from '../manifest/template.js';
import { sym } from '../ui/sym.js';

export function artifactDir(targetPath: string): string {
  return path.join(targetPath, '.proxima', 'templateizer');
}

function inferSections(manifest: unknown) {
  const parsed = safeManifest(manifest);
  return parsed?.pages.flatMap((page) => page.sections.map((section) => ({ page: page.path, ...section }))) ?? [];
}

function inferAttributes(manifest: unknown) {
  const parsed = safeManifest(manifest);
  return parsed?.section_types.map((sectionType) => ({
    section_type: sectionType.key,
    attributes: sectionType.attribute_schema,
  })) ?? [];
}

function inferSmartCollections(manifest: unknown) {
  const parsed = safeManifest(manifest);
  return parsed?.smart_collection_placeholders ?? [];
}

function buildReport(input: {
  command: string;
  targetPath: string;
  pages: Array<JsonRecord>;
  componentFiles: string[];
  manifestPath: string | null;
}) {
  return [
    '# Templateizer Report',
    '',
    `- Command: ${input.command}`,
    `- Target: ${input.targetPath}`,
    `- Manifest: ${input.manifestPath ?? 'not found'}`,
    `- Pages detected: ${input.pages.length}`,
    `- Component/source files detected: ${input.componentFiles.length}`,
    '',
    '## Pages',
    '',
    ...input.pages.map((page) => `- ${page.path}: ${page.file}`),
    '',
  ].join('\n');
}

export function buildArtifacts(targetPath: string, command: string) {
  const pages = discoverPages(targetPath);
  const componentFiles = findFiles(path.join(targetPath, 'src'), ['.astro', '.tsx', '.ts']).filter(
    (file) => !file.includes(`${path.sep}pages${path.sep}`),
  );
  const manifestPath = findManifestPath(targetPath);
  const manifest = manifestPath ? readJson(manifestPath) : null;

  return {
    'pages.json': pages,
    'sections.json': inferSections(manifest),
    'attributes.json': inferAttributes(manifest),
    'smart-collections.json': inferSmartCollections(manifest),
    'manifest.generated.json': manifest ?? {},
    'report.md': buildReport({ command, targetPath, pages, componentFiles, manifestPath }),
  };
}

export function writeArtifacts(targetPath: string, artifacts: Record<string, unknown>): void {
  const outputDir = artifactDir(targetPath);
  mkdirSync(outputDir, { recursive: true });
  for (const [filename, value] of Object.entries(artifacts)) {
    const fullPath = path.join(outputDir, filename);
    const payload = filename.endsWith('.md') ? String(value) : `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(fullPath, payload);
  }
}

export async function runArtifactCommand(targetPath: string, command: string): Promise<number> {
  const artifacts = buildArtifacts(targetPath, command);
  writeArtifacts(targetPath, artifacts);
  console.log(sym.ok(`Templateizer ${pc.bold(command)} complete. Artifacts written to ${pc.dim(artifactDir(targetPath))}`));
  return 0;
}
