# Tasks — proxima-storefront-sdk / i18n-locale-url-seo

## 1. Types

- [x] 1.1 Extend `PageSummary` / `ProximaRenderWebsite` with `localized_paths`, `enabled_locales`, `default_locale`
- [x] 1.2 Export types from package index

## 2. Render fetch

- [x] 2.1 Add `locale?: string` to `fetchProximaRender` config
- [x] 2.2 Pass `?locale=` + `Accept-Language` via storefront client
- [x] 2.3 Unit test for query/header forwarding

## 3. SEO helpers

- [x] 3.1 Implement `buildCanonicalUrl(domain, locale, path, defaultLocale)`
- [x] 3.2 Implement `buildHreflangAlternates({ domain, localizedPaths, enabledLocales, defaultLocale })`
- [x] 3.3 Unit tests: two locales, x-default, missing locale path

## 4. Sitemap

- [x] 4.1 Update `generateSitemapXml` to emit per-locale URLs when `localized_paths` present
- [x] 4.2 Keep single-path fallback for legacy pages
- [x] 4.3 Unit test with mock website pages

## 5. template-schema

- [x] 5.1 Add optional `paths` to `websiteDeployPageSchema`
- [x] 5.2 SuperRefine: collision detection within manifest (same locale + path twice)
- [x] 5.3 Tests in `manifest.test.ts`

## 6. Docs & release

- [x] 6.1 Update `storefront-core` README SEO section
- [ ] 6.2 Update CLI skill `seo` with hreflang example
- [ ] 6.3 Version bump + changeset

**Gate:** publish after API change is on develop (or use `npm link` for local integration).
