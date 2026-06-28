import { buildCanonicalUrl, type HreflangAlternate } from './hreflang.js';
import type { SitemapWebsiteMeta } from '../types/seo.js';

function normalizePath(path: string): string {
  const trimmed = (path || '').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const stripped = withSlash.replace(/\/+$/, '');
  return stripped || '/';
}

/** Replace `{param}` segments in a path template with concrete values. */
export function fillPathTemplate(
  template: string,
  params: Record<string, string>,
): string {
  return normalizePath(
    template.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      const value = params[key];
      if (value === undefined) {
        throw new Error(`Missing path param '${key}' for template '${template}'`);
      }
      return value;
    }),
  );
}

/** Match a request path against a template; returns captured params or null. */
export function matchPathTemplate(
  template: string,
  path: string,
): Record<string, string> | null {
  const normalizedTemplate = normalizePath(template);
  const normalizedPath = normalizePath(path);

  if (!normalizedTemplate.includes('{')) {
    return normalizedTemplate === normalizedPath ? {} : null;
  }

  const templateSegments = normalizedTemplate.split('/').filter(Boolean);
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  if (templateSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < templateSegments.length; i++) {
    const templateSegment = templateSegments[i];
    const pathSegment = pathSegments[i];
    const match = templateSegment.match(/^\{([^{}]+)\}$/);
    if (match) {
      params[match[1]] = pathSegment;
      continue;
    }
    if (templateSegment !== pathSegment) return null;
  }
  return params;
}

function extractPlaceholders(template: string): Set<string> {
  const names = template.match(/\{([^{}]+)\}/g) ?? [];
  return new Set(names.map((token) => token.slice(1, -1)));
}

/** Validate that all locale templates share the same placeholder names. */
export function validateEnginePathPlaceholders(
  localizedPaths: Record<string, string>,
): string | null {
  const locales = Object.keys(localizedPaths);
  if (locales.length === 0) return null;

  let reference: Set<string> | null = null;
  for (const locale of locales) {
    const placeholders = extractPlaceholders(localizedPaths[locale] ?? '');
    if (reference === null) {
      reference = placeholders;
      continue;
    }
    const ref = [...reference].sort().join(',');
    const cur = [...placeholders].sort().join(',');
    if (ref !== cur) {
      return `Placeholder mismatch for locale '${locale}': expected {${ref}}, got {${cur}}`;
    }
  }
  return null;
}

export function findWebsitePageByResolver(
  pages: SitemapWebsiteMeta['pages'],
  resolverKind: string,
) {
  return pages?.find((page) => page.resolver_kind === resolverKind) ?? null;
}

/** Build an absolute URL for an engine page (PDP, PLP, category, brand). */
export function buildEnginePageUrl(
  domain: string,
  locale: string,
  localizedPaths: Record<string, string>,
  routeParams: Record<string, string>,
  defaultLocale: string,
): string {
  const template =
    localizedPaths[locale] ?? localizedPaths[defaultLocale];
  if (!template) {
    throw new Error(`No path template for locale '${locale}'`);
  }
  const logicalPath = fillPathTemplate(template, routeParams);
  return buildCanonicalUrl(domain, locale, logicalPath, defaultLocale);
}

/** Hreflang alternates for engine pages that share route params across locales. */
export function buildEnginePageHreflangAlternates(options: {
  domain: string;
  localizedPaths: Record<string, string>;
  enabledLocales: string[];
  defaultLocale: string;
  routeParams: Record<string, string>;
}): HreflangAlternate[] {
  const { domain, localizedPaths, enabledLocales, defaultLocale, routeParams } = options;
  const alternates: HreflangAlternate[] = [];

  for (const locale of enabledLocales) {
    const template = localizedPaths[locale] ?? localizedPaths[defaultLocale];
    if (!template) continue;
    alternates.push({
      hreflang: locale,
      href: buildEnginePageUrl(domain, locale, localizedPaths, routeParams, defaultLocale),
    });
  }

  const defaultTemplate = localizedPaths[defaultLocale];
  if (defaultTemplate) {
    alternates.push({
      hreflang: 'x-default',
      href: buildEnginePageUrl(
        domain,
        defaultLocale,
        localizedPaths,
        routeParams,
        defaultLocale,
      ),
    });
  }

  return alternates;
}

/** Slug from a catalog nav href such as `/categoria/foo`. */
export function slugFromCatalogHref(href: string, segment: string): string | null {
  const prefix = `/${segment}/`;
  if (!href.startsWith(prefix)) return null;
  const slug = href.slice(prefix.length).split('/')[0];
  return slug || null;
}
