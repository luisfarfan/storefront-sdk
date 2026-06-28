# Spec: Sitemap Multilocale

## ADDED Requirements

### Requirement: Sitemap emits one URL per locale for content pages
`generateSitemapXml()` SHALL emit a separate `<url>` entry for each `(page, locale)` pair when `localized_paths` or `paths` is available on page summaries.

#### Scenario: Home in two locales
- **WHEN** home has `paths: { es: "/", en: "/" }` or `{ es: "/", en: "/en" }` per routing convention
- **THEN** sitemap contains distinct loc entries for each locale URL

#### Scenario: Backward compat single path
- **WHEN** page has only `path` without `localized_paths`
- **THEN** sitemap emits one URL (current behavior)

### Requirement: Catalog URLs unchanged in v1
Product, category, and brand URLs in sitemap remain single-locale until catalog slug i18n is implemented.
