export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

function normalizePath(path: string): string {
  const trimmed = (path || "").trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function siteOrigin(domain: string): string {
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    return domain.replace(/\/$/, "");
  }
  return `https://${domain.replace(/\/$/, "")}`;
}

/**
 * Build an absolute canonical URL with locale-prefix routing.
 * Default locale omits the prefix; others use `/{locale}{path}`.
 */
export function buildCanonicalUrl(
  domain: string,
  locale: string,
  path: string,
  defaultLocale: string,
): string {
  const normalizedPath = normalizePath(path);
  const origin = siteOrigin(domain);
  if (locale === defaultLocale) {
    return `${origin}${normalizedPath}`;
  }
  if (normalizedPath === "/") {
    return `${origin}/${locale}`;
  }
  return `${origin}/${locale}${normalizedPath}`;
}

/**
 * Build hreflang alternate links for a CMS page with localized paths.
 */
export function buildHreflangAlternates(options: {
  domain: string;
  localizedPaths: Record<string, string>;
  enabledLocales: string[];
  defaultLocale: string;
}): HreflangAlternate[] {
  const { domain, localizedPaths, enabledLocales, defaultLocale } = options;
  const alternates: HreflangAlternate[] = [];

  for (const locale of enabledLocales) {
    const path = localizedPaths[locale] ?? localizedPaths[defaultLocale];
    if (!path) continue;
    alternates.push({
      hreflang: locale,
      href: buildCanonicalUrl(domain, locale, path, defaultLocale),
    });
  }

  const defaultPath = localizedPaths[defaultLocale];
  if (defaultPath) {
    alternates.push({
      hreflang: "x-default",
      href: buildCanonicalUrl(domain, defaultLocale, defaultPath, defaultLocale),
    });
  }

  return alternates;
}
