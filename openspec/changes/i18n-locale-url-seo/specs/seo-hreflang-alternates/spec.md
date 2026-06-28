# Spec: SEO Hreflang Alternates

## ADDED Requirements

### Requirement: Build hreflang alternate links from localized paths
The SDK SHALL export `buildHreflangAlternates()` that returns absolute URLs for each enabled locale plus `x-default`.

#### Scenario: Two-locale content page
- **WHEN** `localized_paths = { es: "/catalogo", en: "/catalog" }`, `enabled_locales = ["es","en"]`, `default_locale = "es"`, `domain = "base.localhost"`
- **THEN** output includes `{ locale: "es", href: "https://base.localhost/catalogo" }`, `{ locale: "en", href: "https://base.localhost/en/catalog" }`, and `{ locale: "x-default", href: "https://base.localhost/catalogo" }`

#### Scenario: Missing path for a locale
- **WHEN** `enabled_locales` includes `"fr"` but `localized_paths` has no `fr` key
- **THEN** no alternate is emitted for `fr` (no broken links)

### Requirement: Build canonical URL helper
The SDK SHALL export `buildCanonicalUrl(domain, locale, path, defaultLocale)` applying the locale-prefix rule: default locale omits prefix; others use `/{locale}{path}`.
