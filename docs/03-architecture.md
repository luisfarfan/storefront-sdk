# 03 — Arquitectura de archivos

Estructura recomendada para un storefront Proxima single-tenant en Astro (patrón golden template).

---

## Estructura completa

```
apps/{slug}/                    # o proyecto standalone
├── proxima.website.json        # Manifiesto: section_types, pages, shell, placeholders
├── .proxima/credentials.json   # proxima init (gitignored)
├── .env                        # PROXIMA_API_URL, PROXIMA_WEBSITE_DOMAIN, PROXIMA_SERVICE_KEY
├── astro.config.mjs            # SSR + node adapter
└── src/
    ├── layouts/
    │   └── SiteLayout.astro    # HTML base, shell (header/mega_menu/footer), analytics
    ├── pages/
    │   ├── [...path].astro     # Catch-all → resolveRequest → views / SectionRenderer
    │   └── api/buyer/          # Thin routes → @proxima-io/storefront-core process*
    ├── components/
    │   ├── sections/           # Secciones CMS por page
    │   │   └── SectionRenderer.astro   # SECTION_REGISTRY
    │   ├── layout/             # Header, MegaMenu, Footer (consumen shell values)
    │   └── commerce/           # CartView, CheckoutView, ProductDetail, …
    ├── views/                  # Despacho por resolver_kind (ProductListPage, …)
    ├── lib/
    │   ├── config.ts           # domain, data_mode, fixtures host
    │   ├── resolver.ts         # resolveRequest, mapApiWebsite
    │   ├── cms-types.ts        # ResolvedWebsite, WebsiteSection, …
    │   └── storefront-data.ts  # StorefrontDataSource (live / fixtures-commerce)
    └── fixtures/               # Demo template: website, composition, shell, catálogo
```

---

## Single-tenant

Un proceso = un website. El dominio viene de **`PROXIMA_WEBSITE_DOMAIN`** en `.env` — no hay detección de hostname.

```env
PROXIMA_API_URL=http://localhost:8000
PROXIMA_WEBSITE_DOMAIN=mitienda.localhost
PROXIMA_SERVICE_KEY=pxa_test_...
PROXIMA_DATA_MODE=fixtures   # opcional: fixtures en dev
```

---

## Flujo de request

```
[...path].astro
  resolveRequest(Astro.request)
    → fetchProximaWebsite + fetchProximaComposition (o fixtures)
    → ResolvedRequest { website, page, product?, path, status }

  SiteLayout(website, page)
    website.shell_sections.header|mega_menu|footer  ← global
    slot → view según resolver_kind o SectionRenderer(page.sections)
```

**Shell** y **page sections** son rutas de render distintas. Ver [01-mental-model.md](./01-mental-model.md).

---

## Catch-all `[...path].astro`

Una página maneja todas las rutas CMS + commerce:

```astro
---
import SiteLayout from "@/layouts/SiteLayout.astro";
import { resolveRequest } from "@/lib/resolver";
import SectionRenderer from "@/components/sections/SectionRenderer.astro";
import ProductListPage from "@/views/ProductListPage.astro";
// … otras views por resolver_kind

const resolved = await resolveRequest(Astro.request);
if (resolved.status === "not_found") return Astro.redirect("/404");

const { website, page } = resolved;
const cmsPreview = Astro.url.searchParams.has("proxima_preview");
---
<SiteLayout {website} {page} {cmsPreview}>
  {page?.resolver_kind === "product_list" && (
    <ProductListPage website={website} page={page} />
  )}
  {page?.sections?.map((section) => (
    <SectionRenderer {section} {cmsPreview} website={website} />
  ))}
</SiteLayout>
```

Vistas commerce (`cart`, `checkout`, `product_detail`) suelen tener componentes dedicados en `src/views/` o `src/components/commerce/` además de secciones CMS opcionales (`commerce_view`).

---

## SectionRenderer y SECTION_REGISTRY

```astro
---
// SectionRenderer.astro — único registro de section types
const SECTION_REGISTRY = {
  hero_bento: HeroBento,
  product_grid: ProductGrid,
  // …
} as const;

const Component = SECTION_REGISTRY[section.type as keyof typeof SECTION_REGISTRY];
---
{Component ? (
  <Component
    cmsPreview={cmsPreview}
    attributesMeta={section.attributesMeta}
    {...mapSectionValues(section)}
  />
) : null}
```

El `key` en `proxima.website.json` → `section_types[].key` debe coincidir con `SECTION_REGISTRY`.

---

## SiteLayout y shell

```astro
---
const headerSection = website.shell_sections?.header;
const megaMenuSection = website.shell_sections?.mega_menu;
const footerSection = website.shell_sections?.footer;

const headerData = headerSection?.values ?? {};
const megaMenuData = megaMenuSection?.values ?? {};
// category tree: fetch API (catálogo) + fusionar category_overrides de megaMenuData
---
<Header data={headerData} … />
<MegaMenu data={megaMenuData} navTree={navTree} … />
<slot />
<Footer data={footerSection?.values} … />
```

---

## API routes (commerce)

Patrón thin wrapper — misma firma en todos los storefronts:

```ts
// src/pages/api/buyer/cart/add.ts
import type { APIRoute } from "astro";
import { processAddToCart } from "@proxima-io/storefront-core";
import { getProximaEnv } from "@/lib/config";

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const env = getProximaEnv();
  // … parse body, session cookie, delegar a processAddToCart
};
```

Ver [07-commerce.md](./07-commerce.md) para auth, carrito, guest checkout.

---

## Modos de datos

| Modo | Cuándo | Fuente |
|------|--------|--------|
| **live** | Website merchant | API Proxima |
| **fixtures** | Demo template / dev offline | `src/fixtures/*.json` + `fixtures-commerce` |

`resolveRequest` elige modo según `PROXIMA_DATA_MODE`, `website.data_mode`, o dominio demo.

---

## CLI y skills

```bash
npm install -g @proxima-io/cli
proxima init
proxima deploy
proxima skills install    # agent workflows → .cursor/skills, .claude/skills
```

Ver [09-deploy.md](./09-deploy.md) y [10-agent-skills.md](./10-agent-skills.md).

---

## Siguiente lectura

1. [Sections y attributes](./04-sections-and-attributes.md)
2. [Builder integration](./06-builder-integration.md)
3. [Deploy manifiesto](./09-deploy.md)
