# 01 — Modelo mental de Proxima

Antes de escribir código, entender este modelo te ahorra horas de confusión.
La referencia viva del golden template es `apps/214store/proxima.website.json` en el monorepo de storefronts.

---

## Tres capas — no confundirlas

Proxima mezcla tres planos distintos. Cada uno tiene su fuente de verdad:

| Capa | Fuente de verdad | Quién la edita | Qué define |
|------|------------------|----------------|------------|
| **Manifiesto (developer)** | `proxima.website.json` en el repo del storefront | Developer / agency | Tipos de sección, schemas del Builder, páginas, scaffolds, shell, placeholders de smart collections |
| **Runtime CMS (merchant)** | Filas en la API (`Website`, `WebsitePage`, `WebsiteSection`, …) | Comercio vía Builder | Valores concretos de cada sección, smart collections configuradas, overrides |
| **Catálogo (commerce)** | API de productos/categorías/marcas | Admin de catálogo | Datos de inventario — **no** son secciones CMS |

```
proxima.website.json          API (website del comercio)           Storefront Astro
─────────────────────         ──────────────────────────           ─────────────────
section_types[]        ──deploy──► WebsiteSectionType[]     ──resolve──► attribute_schema (Builder)
pages[] + scaffold     ──deploy──► WebsitePage[]                     composition JSON
shell_sections[]       ──deploy──► WebsiteShellSection[]             section.values → props
smart_collection_      ──instantiate► SmartCollection[]              SECTION_REGISTRY[type]
  placeholders{}                (o auto al detectar catálogo)
default_values         ──scaffold──► valores iniciales              componentes Astro
shell_default_values   ──scaffold──► shell inicial
```

**Deploy (`proxima deploy`)** sincroniza schemas y estructura — **no** sube catálogo ni contenido editorial del home si la página ya tiene secciones del merchant.

---

## La frase clave

> **Proxima no es un headless CMS donde tú pides los datos página por página. Es un sistema donde la API ya resolvió la composición — tú renderizas lo que recibes.**

En un headless CMS tradicional:
```
Storefront → pide página → pide productos → pide categorías → ensambla → renderiza
```

En Proxima (contenido CMS):
```
Storefront → fetchProximaComposition(path) → renderiza sections + shell
```

La API resuelve smart collections embebidas en atributos, SEO, locale, moneda y `resolved_data` de entidades (producto, categoría, marca). El storefront recibe JSON completo para esa ruta.

**Excepciones intencionales** (no van en la composición CMS):
- Árbol de categorías del mega menú → `GET /storefront/categories/tree` (catálogo live)
- PLP con filtros URL → `fetchProductListing()` lee `?brand=&price_min=` del browser
- Carrito, auth, checkout → API routes thin + `@proxima-io/storefront-core`

---

## Website — identidad y capacidades

Un **Website** es single-tenant: un dominio = un proceso Astro = un `PROXIMA_WEBSITE_DOMAIN`.

| Campo | Rol |
|-------|-----|
| `domain` | Identidad — no hay detección de hostname en runtime |
| `business_id` | Tenant de catálogo y órdenes |
| `locale` / `currency` | Formato de precios y textos localizables |
| `theme_tokens` | Colores de marca → CSS vars (`brandNeon`, `primary`, …) — nunca hardcodear en componentes |
| `capabilities` | Perfil del sitio: `cart`, `checkout`, `buyer_auth`, `guest_checkout`, … |
| `data_mode` | `live` o `fixtures` — en demo de template usa fixtures locales sin API |
| `shell_sections` | Mapa `{ header, mega_menu, footer }` — **global**, no repetido por página |

---

## Shell vs secciones de página

**Distinción crítica** que el modelo antiguo omitía:

```
Website
├── shell_sections (global — SiteLayout)
│     header      → logo, búsqueda, nav items
│     mega_menu   → labels + category_overrides
│     footer      → columnas, links, newsletter
│
└── pages[]
      └── sections[] (por ruta — SectionRenderer en el catch-all)
            hero_bento, product_grid, commerce_view, …
```

- **Shell**: se declara en `proxima.website.json` → `shell_sections[]` con slots (`key`: `header` | `mega_menu` | `footer`).
- **Page sections**: viven en `pages[].scaffold_sections[]` y se instancian por página.
- En runtime el storefront lee `website.shell_sections.header.values` en `SiteLayout.astro` — **no** como sección más del array de la página.
- Los `section_types` con `"category": "shell"` son tipos reservados al layout global.

Valores iniciales del shell: `shell_default_values{}` en el manifiesto (logo, search, nav, footer copy). El seed local (`fixtures/shell.json`) los materializa en dev; en producción el merchant los edita en Builder.

---

## Pages — rutas y `resolver_kind`

Cada entrada en `pages[]` del manifiesto define una ruta lógica:

```json
{
  "resolver_kind": "content_page",
  "path": "/",
  "label": "Home",
  "scaffold_sections": [
    { "section_type": "hero_bento", "order": 1, "default_values": { "hero_products": "auto:featured_products" } }
  ]
}
```

| `resolver_kind` | Ruta típica | Comportamiento |
|-----------------|-------------|----------------|
| `content_page` | `/`, `/contacto`, `/sobre-nosotros` | Solo secciones CMS; `resolved_data` null |
| `product_list` | `/productos` | PLP — filtros en URL, fetch SDK aparte |
| `product_detail` | `/producto/{slug}` | `resolved_data.product` + secciones opcionales |
| `category_detail` | `/categoria/{slug}` | `resolved_data` categoría + secciones (ej. `product_grid`) |
| `brand_detail` | `/marca/{slug}` | Igual con marca |
| `buyer_search` | `/buscar` | Búsqueda (client-side o SSR según vista) |
| `product_compare` | `/comparar` | Comparador de productos |
| `cart` | `/carrito` | Vista commerce — suele usar `commerce_view` |
| `checkout` | `/checkout` | Checkout auth o guest |
| `buyer_login` | `/cuenta/login` | Auth |
| `buyer_register` | `/cuenta/registro` | Registro |
| `buyer_password_reset` | `/cuenta/restablecer` | Reset password |
| `buyer_account` | `/cuenta` | Dashboard cuenta |
| `order_list` | `/cuenta/pedidos` | Historial |
| `order_detail` | `/cuenta/pedidos/{id}` | Detalle de orden |

Solo `content_page` **requiere** `path` en el manifiesto. Los demás `resolver_kind` usan path fijo o parametrizado según convención del template.

El storefront enruta con un catch-all (`[...path].astro`) que llama `resolveRequest()` y despacha a la vista según `page.resolver_kind` / composición.

---

## Section types vs instancias de sección

| Concepto | Dónde vive | Ejemplo |
|----------|------------|---------|
| **Section type** | `section_types[]` en manifiesto → `WebsiteSectionType` en API | `hero_bento`, `product_grid`, `mega_menu` |
| **Instancia** | Fila `WebsiteSection` o `WebsiteShellSection` | Home tiene una instancia de `hero_bento` con sus `values` |
| **Registry storefront** | `SectionRenderer.astro` → `SECTION_REGISTRY` | `hero_bento` → `HeroBento.astro` |

El `key` en `section_types[].key` debe coincidir **exactamente** con:
1. El key en `SECTION_REGISTRY`
2. El `section_type` en `scaffold_sections`
3. El `type` que llega en la composición

---

## Attributes — schema, values y meta

Tres nombres que aparecen en código y docs:

| Nombre | Capa | Qué es |
|--------|------|--------|
| **`attribute_schema`** | Manifiesto / `WebsiteSectionType` | Define campos del Builder: `name`, `label`, `type`, `order`, `config`, `options`, `localizable`, `default_value` |
| **`values`** (runtime) | Instancia de sección | Lo que el merchant editó — llega como `section.values.*` al storefront |
| **`attributesMeta`** | Builder preview | Mapa por campo para inline editing — `getSectionAttr(attributesMeta)` del builder-sdk |

Convención del golden template:
```ts
interface Props {
  cmsPreview?: boolean;
  attributesMeta?: Record<string, unknown>;
  heading?: string;  // ← mismo name que attribute_schema[].name
}
```

En `SectionRenderer`: `heading={section.values.heading}` + `attributesMeta={section.attributesMeta}`.

Doc detallada de tipos y `config`: [07-cms-attribute-schema.md](./07-cms-attribute-schema.md).

### Tipos de atributo

| Tipo | Almacena | Notas |
|------|----------|-------|
| `text` | string | `localizable: true` → valor por idioma |
| `rich_text` | HTML/markdown | |
| `image` | URL | |
| `boolean` | bool | |
| `number` | number | `config.min` / `config.max` |
| `link` | `{ url, label, target?, is_external? }` | |
| `select` | string (value de opción) | `options[]` con `value`, `label`, `description` |
| `array` | lista de objetos | `config.schema.item_fields[]` — sub-formularios |
| `smart_collection_id` | referencia → **resuelta en composición** | Ver abajo |

Tipos dentro de `item_fields` de arrays: `text`, `select`, `boolean`, `product-picker`, etc.

### `smart_collection_id` — referencia resuelta

En el Builder el merchant elige o crea una Smart Collection. En la composición llega **ya resuelta**:

```json
{
  "values": {
    "hero_products": {
      "type": "product_list",
      "items": [{ "id": 1, "slug": "...", "name": "...", "price_formatted": "S/ 299.90" }],
      "meta": { "limit": 8, "returned": 6, "total": 42 }
    }
  }
}
```

El componente hace `(hero_products?.items ?? []).map(...)` — sin fetch extra.

---

## Smart Collections

Query guardada que el comercio configura en Builder. Seis tipos:

| Tipo | Devuelve |
|------|----------|
| `product_list` | Productos filtrados/ordenados |
| `category_list` | Categorías |
| `brand_list` | Marcas |
| `banner` | Una entidad promocionada |
| `manual` | Lista curada a mano |
| `search_preview` | Preview de búsqueda con query fijo |

Doc de renderizado: [05-smart-collections.md](./05-smart-collections.md).

### Placeholders del template (`smart_collection_placeholders`)

En el manifiesto el developer declara colecciones **nombradas** para bootstrapping:

```json
"smart_collection_placeholders": {
  "featured_products": {
    "name": "Productos Destacados",
    "type": "product_list",
    "config": { "filter": "featured" },
    "cache_ttl": 300
  }
}
```

Referencias con prefijo **`auto:`** en `default_values`:

```json
"default_values": { "hero_products": "auto:featured_products" }
```

Al instanciar template o detectar catálogo, la API crea/resuelve la Smart Collection real y enlaza el atributo. Idempotencia API-side.

---

## Defaults — cuándo se aplican

| Mecanismo | Dónde | Cuándo aplica |
|-----------|-------|---------------|
| `attribute_schema[].default_value` | Schema del tipo | Valor por defecto en formulario Builder para campos nuevos |
| `scaffold_sections[].default_values` | Manifiesto por página | Solo al **primer scaffold** si la página no tiene secciones del merchant |
| `shell_default_values{}` | Manifiesto global | Valores iniciales de slots shell al crear/scaffold website |
| `"auto:…"` en default_values | Scaffold | Resuelve a smart collection placeholder |

Si la página ya tiene contenido del merchant, deploy marca scaffold como `skipped` — no sobrescribe.

---

## Overrides — capa de presentación sobre datos vivos

Overrides **no mutan catálogo**. Son arrays en `values` que el componente fusiona en frontmatter.

### `category_overrides` (shell `mega_menu`)

Menú construido desde `GET /storefront/categories/tree` + capa CMS:

| Campo | Efecto |
|-------|--------|
| `category_slug` | Identifica categoría por slug exacto |
| `badge` | Chip (OFERTA, NUEVO, …) |
| `highlight` | Nombre en color de marca |
| `label_override` | Nombre custom sin tocar catálogo |
| `hidden` | Oculta del menú |

### `product_overrides` (ej. `hero_bento`)

Capa sobre items de una smart collection `product_list`:

| Campo | Efecto |
|-------|--------|
| `product_id` | Producto de la colección (product-picker) |
| `variant` | Tamaño de tile en grid bento (`flagship`, `standard`, …) |
| `badge`, `theme`, `href`, … | Presentación por celda |

Patrón: pre-computar merge en frontmatter Astro (nunca block-body en `.map()` del template).

---

## Sección `commerce_view`

Tipo reutilizable para vistas de commerce (cart, checkout, login, …). Expone copy CMS-editable:

- `eyebrow`, `heading`, `copy`, trust badges, umbrales (`low_stock_threshold` en PDP)
- El componente Astro de la vista lee `section.values` — la lógica de carrito/auth sigue en SDK + API routes

---

## Catálogo vs CMS

| | CMS (sections) | Catálogo |
|--|----------------|----------|
| **Qué** | Layout, copy, qué colección mostrar | Productos, SKUs, stock, categorías reales |
| **Editado en** | Builder | Admin catálogo / import |
| **En storefront** | `section.values`, smart collections resueltas | `resolved_data`, PLP fetch, category tree |

El mega menú es el ejemplo canónico de **fusión**: árbol API + `category_overrides` CMS.

---

## Modos de datos: live vs fixtures

| Modo | Cuándo | Fuente |
|------|--------|--------|
| **live** | Website real del merchant | API Proxima |
| **fixtures** | Demo template (`PROXIMA_TEMPLATE_DEMO_DOMAIN`) o `PROXIMA_DATA_MODE=fixtures` | JSON en `src/fixtures/` |

En fixtures, `loadFixtureComposition()` / `loadFixtureWebsite()` simulan la composición sin red. Commerce puede usar `@proxima-io/storefront-core/fixtures-commerce`.

---

## Flujo completo de un request (corregido)

```
Browser → GET /categoria/gpus

Storefront (Astro SSR):
  1. fetchProximaWebsite(domain)
     → { theme_tokens, capabilities, shell_sections: { header, mega_menu, footer }, pages[] }

  2. fetchProximaComposition({ path }, website)
     → {
          resolver_kind: "category_detail",
          resolved_data: { category: { slug, name, … }, … },
          sections: [                    ← solo secciones DE PÁGINA
            { type: "product_grid", values: { heading: "…", products: { type, items, meta } } }
          ],
          seo: { meta_title, meta_description, entity_name, … }
        }

  3. SiteLayout renderiza shell_sections (header, mega_menu, footer)
     + fetch category tree para mega_menu (catálogo)

  4. SectionRenderer renderiza page.sections en orden

  5. HTML al browser
```

Header/footer **no** vienen en `composition.sections[]` — vienen en `website.shell_sections`.

---

## Deploy, seed e instantiate

| Acción | Comando / herramienta | Resultado |
|--------|----------------------|-----------|
| Sync schemas + páginas vacías + shell | `proxima deploy` | Builder muestra campos correctos |
| Website + catálogo + contenido demo | `seed_*_website.py` (proxima-api) | Datos de dev; luego deploy |
| Publicar en marketplace | `proxima template:create` + `template:publish` | Template registry |
| Crear website desde template | Admin / instantiate API | Copia structure, placeholders SC, shell defaults |

Ver [09-deploy.md](./09-deploy.md) y skill `website-deploy` en el monorepo storefronts.

---

## Builder — empty state contract

Secciones que pueden estar vacías:

```ts
const isEmpty = !heading && items.length === 0;
if (!cmsPreview && isEmpty) return null;           // live: no ocupa espacio
const showEmptyState = cmsPreview && isEmpty;      // Builder: placeholder seleccionable
```

Usar `BuilderEmptyState` del builder-sdk cuando `cmsPreview === true`.

---

## Diagrama de paquetes

```
                    ┌─────────────────────────────┐
                    │    proxima-api               │
                    │  /storefront/cms/websites/   │
                    │  {id}/pages/composition      │
                    └──────────────┬──────────────┘
                                   │ JSON (composición + shell en website)
                    ┌──────────────▼──────────────┐
                    │   storefront-core            │
                    │   fetchProximaComposition()  │
                    │   fetchProductListing() …    │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼──────┐      ┌──────────▼──────┐     ┌──────────▼──────┐
│ storefront-cms │      │  Tu código Astro │     │  builder-sdk    │
│ normalizeSec.. │      │  SiteLayout      │     │  EditableSection│
│                │      │  SectionRenderer │     │  EditableAttribute│
└────────────────┘      └─────────────────┘     └─────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   @proxima-io/cli            │
                    │   proxima deploy / init      │
                    │   → @proxima-io/templateizer │
                    └─────────────────────────────┘
```

---

## Siguiente lectura

| Tema | Doc |
|------|-----|
| Schema de atributos (Builder) | [07-cms-attribute-schema.md](./07-cms-attribute-schema.md) |
| Smart collections en componentes | [05-smart-collections.md](./05-smart-collections.md) |
| Inline editing | [06-builder-integration.md](./06-builder-integration.md) |
| Manifiesto y marketplace | [08-template-authoring.md](./08-template-authoring.md) |
| Deploy | [09-deploy.md](./09-deploy.md) |
