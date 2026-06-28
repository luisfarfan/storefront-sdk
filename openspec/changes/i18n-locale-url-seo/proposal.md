## Why

Con paths localizados en la API (`localized_paths` por página), el SDK debe exponer helpers de SEO internacional (`hreflang`, sitemap multilocale, canonical) y tipos actualizados en el contrato de render. Sin esto, cada storefront reimplementa lógica duplicada y el sitemap actual emite una sola URL por página.

## What Changes

- **Añadir** `buildHreflangAlternates()` y tipos asociados en `storefront-core/seo`.
- **Extender** `generateSitemapXml()` para emitir una `<url>` por `(page, locale)` usando `localized_paths`.
- **Extender** `fetchProximaRender()` para aceptar `locale` explícito (query + `Accept-Language`).
- **Extender** `template-schema` `websiteDeployPageSchema` con `paths?: Record<string, string>` (compat con `path` legacy).
- **Tipar** `ProximaRenderWebsite` con `enabled_locales` y `default_locale`.

## Capabilities

### New Capabilities

- `seo-hreflang-alternates`: helper para `<link rel="alternate" hreflang="…">` desde páginas + locale
- `sitemap-multilocale`: sitemap con URLs por locale
- `render-locale-contract`: tipos y fetch con locale first-class

### Modified Capabilities

- (ninguna spec archivada requiere delta)

## Impact

- **packages/storefront-core**: `seo/`, `cms/website.ts`, `types/cms.ts`, `types/seo.ts`
- **packages/template-schema**: validación manifest pages
- **packages/cli**: skills `seo` — referenciar nuevos helpers
- **Dependencia**: deploy API con `localized_paths` antes de sitemap real multilocale en live

## Coordinación cross-repo

| Repo | Change hermano |
|------|----------------|
| proxima-api | `openspec/changes/i18n-locale-url-seo/` |
| proxima-storefronts | `openspec/changes/i18n-locale-url-seo/` |
