import { describe, it, expect } from 'vitest';
import {
  isCmsPreview,
  getPreviewRobots,
  normalizeCmsSection,
  toSectionMeta,
  resolveCmsCompositionPageId,
  getAttributeMeta,
} from '../src/index.js';

describe('isCmsPreview', () => {
  it('returns true for cms_preview=1', () => {
    expect(isCmsPreview(new URL('http://localhost/?cms_preview=1'))).toBe(true);
  });

  it('returns false when absent', () => {
    expect(isCmsPreview(new URL('http://localhost/'))).toBe(false);
  });
});

describe('getPreviewRobots', () => {
  it('returns noindex,nofollow in preview', () => {
    expect(getPreviewRobots('index,follow', true)).toBe('noindex,nofollow');
  });

  it('passes through original robots outside preview', () => {
    expect(getPreviewRobots('index,follow', false)).toBe('index,follow');
  });
});

describe('normalizeCmsSection', () => {
  it('normalizes a well-formed section', () => {
    const result = normalizeCmsSection({
      id: 10,
      type: 'hero_split',
      name: 'Hero',
      attributes: { heading: 'Hello' },
      attributes_meta: { heading: { type: 'text', label: 'Heading', order: 0 } },
    });
    expect(result.id).toBe(10);
    expect(result.type).toBe('hero_split');
    expect(result.attributes?.heading).toBe('Hello');
    expect(result.attributes_meta?.heading?.type).toBe('text');
  });

  it('handles camelCase attributesMeta', () => {
    const result = normalizeCmsSection({
      id: 11,
      type: 'feature_rows',
      attributesMeta: { title: { attributeKey: 'title', type: 'text' } },
    });
    expect(result.attributes_meta?.title).toBeDefined();
  });

  it('returns safe defaults for invalid input', () => {
    expect(normalizeCmsSection(null)).toEqual({ id: '', type: '', attributes: {} });
    expect(normalizeCmsSection(42)).toEqual({ id: '', type: '', attributes: {} });
  });
});

describe('toSectionMeta', () => {
  it('builds metadata from section', () => {
    const section = normalizeCmsSection({ id: 5, type: 'hero_split', name: 'Hero' });
    const meta = toSectionMeta(20, section);
    expect(meta?.pageId).toBe(20);
    expect(meta?.sectionId).toBe(5);
    expect(meta?.sectionType).toBe('hero_split');
    expect(meta?.sectionName).toBe('Hero');
  });

  it('returns undefined for null section', () => {
    expect(toSectionMeta(1, null)).toBeUndefined();
    expect(toSectionMeta(1, undefined)).toBeUndefined();
  });
});

describe('resolveCmsCompositionPageId', () => {
  it('reads page.id', () => {
    expect(resolveCmsCompositionPageId({ page: { id: 99 } })).toBe(99);
  });

  it('reads top-level page_id', () => {
    expect(resolveCmsCompositionPageId({ page_id: '42' })).toBe('42');
  });

  it('reads camelCase pageId', () => {
    expect(resolveCmsCompositionPageId({ pageId: 7 })).toBe(7);
  });

  it('returns null when absent', () => {
    expect(resolveCmsCompositionPageId(null)).toBeNull();
    expect(resolveCmsCompositionPageId({})).toBeNull();
  });
});

describe('getAttributeMeta', () => {
  it('returns metadata for an attribute', () => {
    const section = normalizeCmsSection({
      id: 1,
      type: 'hero',
      attributes_meta: { heading: { type: 'text', label: 'Heading', order: 0 } },
    });
    const meta = getAttributeMeta(section, 'heading');
    expect(meta?.type).toBe('text');
  });

  it('returns undefined for unknown key', () => {
    const section = normalizeCmsSection({ id: 1, type: 'hero' });
    expect(getAttributeMeta(section, 'nonexistent')).toBeUndefined();
  });

  it('handles null section', () => {
    expect(getAttributeMeta(null, 'heading')).toBeUndefined();
  });
});
