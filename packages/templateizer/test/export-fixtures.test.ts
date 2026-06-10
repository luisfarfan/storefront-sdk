import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { WebsiteExportResponse } from '@proxima-io/template-registry-client';
import { writeFixtureExport } from '../src/export/write-fixture-export.js';

const SAMPLE_RESPONSE: WebsiteExportResponse = {
  export_schema_version: '1.0',
  website_domain: 'tech-store.proxima.pe',
  scope: 'cms',
  manifest: {
    schema_version: '1.0',
    section_types: [{ key: 'hero', label: 'Hero', category: 'content', attribute_schema: [] }],
    pages: [{ resolver_kind: 'content_page', path: '/', label: 'Home' }],
  },
  fixtures: {
    website: { id: 'fixture-tech-store', domain: 'tech-store.localhost' },
    shell: { header: { section_id: 1, section_type: 'header', attributes: {} } },
    compositions: {
      home: {
        path: '/',
        resolver_kind: 'content_page',
        sections: [],
      },
    },
  },
  meta: {
    exported_at: '2026-06-10T00:00:00Z',
    page_count: 1,
    composition_keys: ['home'],
    fixture_domain: 'tech-store.localhost',
  },
};

describe('writeFixtureExport', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('writes manifest, website, shell, and composition files', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'export-fixtures-'));
    const plans = await writeFixtureExport(tempDir, SAMPLE_RESPONSE);
    const created = plans.filter((p) => p.action === 'create').map((p) => p.relativePath);

    expect(created).toContain('proxima.website.json');
    expect(created).toContain(path.join('src', 'fixtures', 'website.json'));
    expect(created).toContain(path.join('src', 'fixtures', 'shell.json'));
    expect(created).toContain(path.join('src', 'fixtures', 'compositions', 'home.json'));

    const manifest = JSON.parse(await readFile(path.join(tempDir, 'proxima.website.json'), 'utf8'));
    expect(manifest.section_types[0].key).toBe('hero');
  });

  it('dry-run does not write files', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'export-fixtures-dry-'));
    await writeFixtureExport(tempDir, SAMPLE_RESPONSE, { dryRun: true });

    await expect(readFile(path.join(tempDir, 'proxima.website.json'), 'utf8')).rejects.toThrow();
  });
});
