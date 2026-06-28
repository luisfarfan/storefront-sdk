## Context

Storefronts consumen `GET /storefront/render` y helpers SEO del SDK. Hoy `generateSitemapXml` itera `website.pages[].path` una vez; `buildPageSeo` resuelve meta localizado si la API manda dicts pero no hay helper `hreflang`. `fetchProximaRender` no expone `locale` en su config pública.

## Goals / Non-Goals

**Goals:**

- API estable para alternates: input = página lógica + `localized_paths` + `enabled_locales` + dominio
- Sitemap con N URLs por página de contenido
- Tipos TypeScript alineados con API post-change

**Non-Goals:**

- Locale prefix parsing (storefront)
- Catálogo URLs multilocale en sitemap v1 (seguir `/producto/{slug}` único hasta change catálogo)
- Builder components

## Decisions

### D1: `buildHreflangAlternates()`

```ts
interface HreflangAlternate {
  locale: string;
  href: string; // absolute URL
}

function buildHreflangAlternates(params: {
  domain: string;
  localizedPaths: Record<string, string>; // from page or website.pages[]
  enabledLocales: string[];
  defaultLocale: string;
}): HreflangAlternate[]
```

- Emite entrada por locale habilitado que tenga path
- Añade `x-default` → path del `defaultLocale`
- No deduce paths — lee datos de API/manifest

### D2: `generateSitemapXml` multilocale

Para cada `content_page` con `paths`:

```
https://{domain}{paths[locale]}  × cada locale en enabled_locales
```

Catálogo (categorías/marcas/productos): **sin cambio v1** — URLs únicas; hreflang de catálogo en change futuro.

### D3: `fetchProximaRender` locale

Extender config:

```ts
fetchProximaRender({ ..., locale?: string })
```

→ query `?locale=` + header `Accept-Language`. Backward compatible (default sin locale = comportamiento API actual).

### D4: template-schema `paths`

```ts
paths: z.record(z.string().min(1)).optional()
```

SuperRefine: si `content_page`, requiere `path` OR `paths` con al menos default locale. Si ambos, `paths[default]` debe coincidir con `path` o `path` se ignora con warning en deploy.

### D5: Tipos `PageSummary`

```ts
interface PageSummary {
  name: string;
  path: string; // default locale (compat)
  localized_paths?: Record<string, string>;
  resolver_kind: string;
}
```

## Risks

- **[Risk] SDK publicado antes que API** → campos opcionales; sitemap degrada a single-path si `localized_paths` ausente
- **[Risk] Sitemap duplica URLs** si `path` y `paths` divergen → normalizar en helper (prefer `paths`)

## Migration Plan

1. Publicar SDK minor bump con tipos opcionales
2. Actualizar tech-store + base cuando API live
3. Actualizar skill `seo` con ejemplo hreflang

## Open Questions

- ¿Helper `buildCanonicalUrl(domain, locale, path)` en SDK o solo en storefront? **SDK** — reuso entre apps.
