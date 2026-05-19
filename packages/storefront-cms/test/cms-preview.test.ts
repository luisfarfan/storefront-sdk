import { describe, it, expect } from 'vitest';
import {
  isCmsPreview,
  getPreviewRobots,
  normalizeCmsSection,
  resolveCmsCompositionPageId,
  toSectionMeta,
  getAttributeMeta,
  findSectionByType,
  getShellSectionMap,
} from '../src/index.js';

describe('isCmsPreview', () => {
  it('returns true when cms_preview=1', () => {
    expect(isCmsPreview(new URL('http://localhost/?cms_preview=1'))).toBe(true);
  });

  it('returns false when cms_preview is absent', () => {
    expect(isCmsPreview(new URL('http://localhost/'))).toBe(false);
  });

  it('returns false when cms_preview=0', () => {
    expect(isCmsPreview(new URL('http://localhost/?cms_preview=0'))).toBe(false);
  });
});

describe('getPreviewRobots', () => {
  it('returns noindex,nofollow in preview mode', () => {
    expect(getPreviewRobots('index,follow', true)).toBe('noindex,nofollow');
  });

  it('returns original robots outside preview', () => {
    expect(getPreviewRobots('index,follow', false)).toBe('index,follow');
  });
});

describe('normalizeCmsSection', () => {
  it('normalizes snake_case from API', () => {
    const result = normalizeCmsSection({
      id: 1,
      type: 'hero_split',
      attributes: { heading: 'Hola' },
      attributes_meta: { heading: { type: 'text', name: 'Heading' } },
    });
    expect(result.id).toBe(1);
    expect(result.type).toBe('hero_split');
    expect(result.attributes?.heading).toBe('Hola');
    expect(result.attributes_meta?.heading?.type).toBe('text');
  });

  it('normalizes camelCase attributesMeta', () => {
    const result = normalizeCmsSection({
      id: 2,
      type: 'feature_rows',
      attributesMeta: { title: { attributeKey: 'title', type: 'text' } },
    });
    expect(result.attributes_meta?.title?.type).toBe('text');
  });

  it('returns empty record for null input', () => {
    const result = normalizeCmsSection(null);
    expect(result.id).toBe('');
    expect(result.type).toBe('');
    expect(result.attributes).toEqual({});
  });

  it('returns empty record for non-object input', () => {
    const result = normalizeCmsSection('invalid');
    expect(result.type).toBe('');
  });
});

describe('resolveCmsCompositionPageId', () => {
  it('reads page.id', () => {
    expect(resolveCmsCompositionPageId({ page: { id: 42 } })).toBe(42);
  });

  it('reads top-level page_id', () => {
    expect(resolveCmsCompositionPageId({ page_id: '99' })).toBe('99');
  });

  it('reads camelCase pageId', () => {
    expect(resolveCmsCompositionPageId({ pageId: 7 })).toBe(7);
  });

  it('returns null for missing id', () => {
    expect(resolveCmsCompositionPageId({})).toBeNull();
    expect(resolveCmsCompositionPageId(null)).toBeNull();
  });
});

describe('toSectionMeta', () => {
  it('converts a section to meta', () => {
    const section = normalizeCmsSection({ id: 5, type: 'hero_split', name: 'Hero' });
    const meta = toSectionMeta(10, section);
    expect(meta?.pageId).toBe(10);
    expect(meta?.sectionId).toBe(5);
    expect(meta?.sectionType).toBe('hero_split');
    expect(meta?.sectionName).toBe('Hero');
  });

  it('returns undefined for null section', () => {
    expect(toSectionMeta(1, null)).toBeUndefined();
  });
});

describe('getShellSectionMap', () => {
  it('extracts shell sections by type', () => {
    const sections = [
      { id: 1, type: 'header', name: 'Header' },
      { id: 2, type: 'footer', name: 'Footer' },
      { id: 3, type: 'hero_split', name: 'Hero' },
    ];
    const map = getShellSectionMap(10, sections);
    expect(map.header?.sectionType).toBe('header');
    expect(map.footer?.sectionType).toBe('footer');
    expect(map.ticker).toBeUndefined();
    expect(map.mega_menu).toBeUndefined();
  });
});
