import { describe, expect, it } from 'vitest';
import {
  buildEnginePageHreflangAlternates,
  buildEnginePageUrl,
  fillPathTemplate,
  matchPathTemplate,
  validateEnginePathPlaceholders,
} from '../src/seo/engine-url.js';

describe('engine-url helpers', () => {
  const paths = { es: '/producto/{slug}', en: '/product/{slug}' };

  it('fills path templates with params', () => {
    expect(fillPathTemplate('/producto/{slug}', { slug: 'g502' })).toBe('/producto/g502');
  });

  it('matches dynamic templates', () => {
    expect(matchPathTemplate('/product/{slug}', '/product/g502')).toEqual({ slug: 'g502' });
    expect(matchPathTemplate('/catalogo', '/catalog')).toBeNull();
  });

  it('builds locale-prefixed engine URLs', () => {
    expect(
      buildEnginePageUrl('shop.test', 'en', paths, { slug: 'g502' }, 'es'),
    ).toBe('https://shop.test/en/product/g502');
    expect(
      buildEnginePageUrl('shop.test', 'es', paths, { slug: 'g502' }, 'es'),
    ).toBe('https://shop.test/producto/g502');
  });

  it('builds hreflang alternates preserving slug', () => {
    const alternates = buildEnginePageHreflangAlternates({
      domain: 'shop.test',
      localizedPaths: paths,
      enabledLocales: ['es', 'en'],
      defaultLocale: 'es',
      routeParams: { slug: 'g502' },
    });
    expect(alternates).toEqual(
      expect.arrayContaining([
        { hreflang: 'es', href: 'https://shop.test/producto/g502' },
        { hreflang: 'en', href: 'https://shop.test/en/product/g502' },
        { hreflang: 'x-default', href: 'https://shop.test/producto/g502' },
      ]),
    );
  });

  it('detects placeholder mismatches', () => {
    expect(
      validateEnginePathPlaceholders({ es: '/producto/{slug}', en: '/product/{id}' }),
    ).toContain('Placeholder mismatch');
  });

  it('handles home path edge case', () => {
    expect(matchPathTemplate('/', '/')).toEqual({});
  });
});
