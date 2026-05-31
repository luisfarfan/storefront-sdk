---
name: add-smart-collection
description: >
  Agregar una Smart Collection (consulta dinámica de catálogo) a un storefront:
  carriles de productos, grids de categorías, strips de marcas, secciones featured.
  Usar cuando: "agregar un carril de productos destacados", "mostrar las marcas
  dinámicamente", "una sección de más vendidos", "smart collection", "colección
  dinámica", "que muestre productos en oferta automáticamente".
---

# Skill: add-smart-collection

Este skill es autocontenido: cubre el modelo mental, los tipos, los 3 métodos de
creación, el placeholder en el manifest, y cómo consumir el envelope resuelto desde
el storefront.

---

## 1. Qué es una Smart Collection

Una **Smart Collection** (SC) es una "consulta guardada" del catálogo que la API
materializa en items (`products`, `categories` o `brands`) cada vez que se compone
la página. No es una lista estática: es una declaración de *qué mostrar* — orden,
filtro, límite.

- Vive como fila en `cms_smart_collections`, **scoped a un `website_id`**.
- Es **editable por el comercio** desde el Builder (no por el developer del template).
- El storefront **no la consume por slug**: la API la inyecta resuelta dentro de la
  composición de la página, dentro de `section.attributes.<slot>` (ver §6).

> **Mental model.** El template dice *"acá va una lista de productos destacados"*
> mediante un atributo `smart_collection_id`. La SC concreta — qué productos, qué
> orden — la define el comercio (o la API en auto-scaffold). El storefront solo lee
> la lista resuelta.

---

## 2. Decisión: ¿qué tipo?

El tipo lo declara el atributo `smart_collection_id` en su
`config.allowed_smart_collection_types`, y lo materializa la SC concreta.

| `type` | Resuelve a | Config típico | Cuándo |
|--------|-----------|---------------|--------|
| `product_list` | Productos del catálogo | `sort`, `limit`, `filters`, `require_images` | Hero, carriles, grids, PLP, ofertas |
| `category_list` | Categorías visibles | `parent_slug`, `include_children`, `limit` | Grid "explorá por categoría" |
| `brand_list` | Marcas activas | `slugs`, `limit` | Franja de logos |
| `manual` | IDs curados a mano | `product_ids[]` | El comercio quiere control total |
| `banner` | Slot visual (no lista) | `media`, `cta` | Aprovechar ventana `active_*` |

`search_preview` existe pero casi no se usa en templates default.

### `product_list` — el más usado

```json
{
  "type": "product_list",
  "config": {
    "sort": "newest",
    "limit": 8,
    "require_images": true,
    "filters": { "in_stock": true, "on_sale": false, "category_ids": [12], "brand_ids": [3] }
  }
}
```

Valores de `sort`: `newest` (created_at DESC), `best_sellers` (unidades vendidas),
`price_asc` / `price_desc`, `manual` (respeta `product_ids`).

### `category_list` / `brand_list`

```json
{ "type": "category_list", "config": { "include_children": true, "parent_slug": "componentes", "limit": 6 } }
{ "type": "brand_list",    "config": { "limit": 8, "slugs": ["asus", "msi", "gigabyte"] } }
```

### Patrones comunes

| Patrón | Tipo | Config |
|--------|------|--------|
| Featured hero | `product_list` | `sort: newest`, `require_images: true`, `limit: 4–8` |
| Best sellers | `product_list` | `sort: best_sellers`, `limit: 8–12` |
| Recién llegados | `product_list` | `sort: newest`, `filters: { in_stock: true }` |
| Ofertas relámpago | `product_list` | `filters: { on_sale: true }`, `active_until`, `display.countdown_target_at` |
| Grid categorías | `category_list` | `limit: 6`, `include_children: true` |
| Franja marcas | `brand_list` | `limit: 8` |

---

## 3. Decisión: ¿qué método?

Hay **tres formas** de que una SC llegue a existir en la BD del comercio. Cada una
responde a un momento distinto del lifecycle.

| Método | Cuándo | Quién decide la config |
|--------|--------|------------------------|
| **A. Placeholder en manifest** | El developer **sabe desde el día 1** qué SCs necesita | El developer del template |
| **B. Auto-scaffold (data-aware)** | Onboarding: que la API elija mirando el catálogo real | La API (priority ladder) |
| **C. Manual (Admin/Builder)** | Ad-hoc, campañas one-off, listas curadas | El comercio |

Para un storefront dev, el camino normal es **A** (declarás placeholders en
`proxima.website.json`). **B** se corre al onboarding del comercio. **C** lo hace el
comercio desde el Builder.

> Se combinan: los placeholders se crean al instantiate; después corrés
> `/auto-scaffold` para llenar slots que el template dejó vacíos (la guard first-run
> evita que toque las SCs ya creadas).

---

## 4. Método A — Placeholder en el manifest (el más común)

### a) Declarar el placeholder

En `proxima.website.json`, en la raíz, bajo `smart_collection_placeholders`:

```json
{
  "smart_collection_placeholders": {
    "featured_products": {
      "name": "Productos destacados",
      "type": "product_list",
      "contract_type": "product_list",
      "config": { "sort": "newest", "require_images": true, "limit": 8 },
      "cache_ttl": 300
    }
  }
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `type` | Sí | `product_list \| category_list \| brand_list \| manual \| banner` |
| `name` | Recomendado | Etiqueta visible en Admin (default: la key) |
| `config` | No | Config inicial de la SC |
| `contract_type` | No | Hint para validadores; típicamente igual a `type` |
| `cache_ttl` | No | TTL en segundos (default 300) |
| `is_active` | No | Default `true` |
| `instantiate_config` | No | Override fino que gana sobre los anteriores |

> **Bias del nombre.** El auto-scaffold (si corre después) usa la key como hint:
> `flash|promo|sale` → ofertas, `best|seller|top` → best_sellers, `new|arrival` →
> newest. Nombrá los placeholders con esas keywords para mejores defaults.

### b) Declarar el atributo `smart_collection_id` en el section_type

En el mismo `proxima.website.json`, dentro del `attribute_schema` del section_type
que va a consumir la SC. **`allowed_smart_collection_types` es load-bearing** — sin
él, el auto-scaffold no sabe qué tipo crear.

```json
{
  "key": "tech_hero_promo",
  "label": "Hero promocional",
  "category": "content",
  "attribute_schema": [
    { "name": "badge_text", "label": "Badge", "type": "text", "localizable": true, "order": 1, "is_required": true },
    {
      "name": "hero_products",
      "label": "Productos hero",
      "type": "smart_collection_id",
      "order": 2,
      "config": {
        "allowed_smart_collection_types": ["product_list"],
        "help_text": "Primer producto = card principal; 2–3 siguientes = side cards."
      }
    }
  ]
}
```

### c) Referenciar el placeholder con `"auto:<key>"`

En `scaffold_sections[].values`, usar el prefijo `auto:`:

```json
{
  "section_type": "tech_hero_promo",
  "order": 1,
  "values": {
    "badge_text": { "es": "Black Week" },
    "hero_products": { "_": "auto:featured_products" }
  }
}
```

`auto:<key>` es la forma legible que escribe el developer. Durante `template:publish`
el templateizer la transforma a la forma canónica que se guarda en S3:

```json
{ "hero_products": { "_": { "_smart_collection_placeholder": "featured_products" } } }
```

Al **instantiate** (cuando el comercio adquiere el template) la API:
1. Crea una fila `SmartCollection` con el `website_id` del merchant, el `type`,
   `name`, `config`, `cache_ttl` declarados.
2. Sustituye cada `{ "_smart_collection_placeholder": "key" }` por el ID entero real.

Resultado: cada merchant tiene **sus propias SCs**, ya cableadas a las secciones.

### d) Publish / deploy

```bash
proxima deploy {slug}        # registra section_types + placeholders en un website
```

> Varias secciones pueden apuntar al **mismo** placeholder (ej. `hero_products` y un
> `product_rail` que reutilizan `featured_products`) — el placeholder garantiza que
> ambas reciben el mismo ID.

---

## 5. Método B — Auto-scaffold (onboarding del comercio)

Cuando no querés prescribir la config; querés que la API elija mirando el catálogo
real del comercio.

```
POST /api/v1/admin/cms/websites/{website_id}/auto-scaffold      (scope: cms:websites:write)
POST /api/v1/admin/cms/websites/deploy?auto_scaffold=true       (hook durante deploy)
```

### Qué hace

1. **Guard first-run.** Si el website ya tiene ≥1 SC → `skipped: true,
   reason: "collections already exist"`. Idempotente, no destructivo, no hay `?force`.
2. **Catalog readiness gate.** Cuenta productos/categorías/marcas/on_sale/con-imagen.
   Si `products + categories + brands == 0` → `skipped, reason: "catalog_empty"`.
3. **Recorre pages → sections** y resuelve cada `attribute_schema`.
4. Por cada atributo `smart_collection_id` vacío con **exactamente un**
   `allowed_smart_collection_types`:
   - `product_list`: **priority ladder** newest → require_images → in_stock → top
     category → best_sellers → on_sale; se queda con el primer candidato cuyo
     `preview_count >= min_items` (default 1; override `attribute.config.scaffold_min_items`).
   - `category_list` / `brand_list`: skip si count es 0 o preview < min_items.
   - `banner`: crea SC inactiva. `manual`: skip.
   - Secciones campaña: seedea `show_countdown`, `countdown_ends_at` (+14 días UTC),
     SC `active_until` y `config.display.countdown_target_at`.
5. Toda SC creada lleva `config.scaffold_origin = "auto"` como breadcrumb.

### Qué retorna

```json
{
  "catalog_readiness": { "products": 184, "categories": 12, "brands": 9, "products_on_sale": 23 },
  "created": [
    { "smart_collection_id": 42, "type": "product_list", "placeholder_key": "hero_products",
      "preview_count": 8, "config_summary": { "sort": "newest", "limit": 8, "require_images": true } }
  ],
  "skipped_slots": [ { "section_id": 17, "attr": "manual_collection", "reason": "type=manual" } ],
  "warnings": []
}
```

### Cuándo se salta un slot

- `ambiguous_type`: el schema declara **cero o más de un** `allowed_smart_collection_types`.
- `catalog_empty`: el comercio aún no tiene catálogo (ver skill `seed-merchant-catalog`).
- `type=manual`: no hay forma data-aware de elegir IDs.
- count de la entidad / preview por debajo de `min_items`.

---

## 6. Consumir desde el storefront

La composición reemplaza el ID guardado por un **envelope resuelto**. El storefront
nunca ve el ID raw — lee `section.attributes.<slot>`:

```ts
const sc = section.attributes.hero_products;   // envelope
const products = sc.items;

if (sc.meta.inactive) {
  // SC apagada o fuera de ventana → items siempre []
}
```

### Forma del envelope

```jsonc
{
  "type": "product_list",            // espejo de collection.type → narrowing en TS
  "items": [ /* productos/categorías/marcas resueltos */ ],
  "meta": { "count": 8, "inactive": false, "inactive_reason": null },
  "collection": { "id": 42, "name": "Hero products", "type": "product_list", "is_active": true,
                  "active_from": null, "active_until": "2026-11-30T23:59:59Z", "config": { } },
  "schedule": { "data_window": { "from": null, "until": "..." },
                "countdown_target_at": "...", "countdown_target_source": "config.display.countdown_target_at" }
}
```

`inactive_reason`: `disabled` (comercio la apagó), `before_start` (`now < active_from`),
`after_end` (`now > active_until`). Cuando `meta.inactive === true`, `items` es **siempre `[]`**.

> `collection.name` es etiqueta de Admin — **nunca** la rendericés como H1. El título
> visible vive en `section.attributes.title` (definido por el schema).

### Empty state — Builder (cmsPreview) vs live

Patrón canónico (ver `add-section` skill para el componente Astro completo):

```tsx
function ProductRail({ section, cmsPreview }: Props) {
  const collection = section.attributes.products_collection;

  if (!collection || collection.meta?.inactive) {
    if (cmsPreview) return <EmptySlotPlaceholder slot="products_collection" />; // target del picker
    return null;  // en live, esconder silenciosamente
  }
  return <Rail items={collection.items} />;
}
```

**Regla:** el empty state solo aparece con `cmsPreview === true`. En live, retornar
`null` sin datos — nunca mostrar el placeholder al comprador.

---

## 7. Campañas con countdown

Para una sección de campaña (`tech_hero_promo`, `flash_offers_band`):

1. El section_type declara dos slots: `campaign_end_date` (`datetime`/`text` ISO) y un
   `smart_collection_id` con `allowed_smart_collection_types: ["product_list"]`.
2. La SC tiene `active_until` = fin de campaña, o `config.display.countdown_target_at`.
3. El storefront prioriza el target: attr `datetime` → SC schedule → null:

```ts
import { resolveSmartCollectionTarget, getCampaignCountdown } from "@proxima-io/storefront-core";

const sc = section.attributes.products_collection;
const targetAt =
  section.attributes_meta?.campaign_end_date?.schedule?.countdown_target_at ??
  resolveSmartCollectionTarget(sc);
const countdown = targetAt ? getCampaignCountdown(targetAt) : null;

if (!cmsPreview && sc?.meta?.inactive) return null;  // campaña vencida → after_end
```

`getCampaignCountdown` corre en cliente para evitar drift con el reloj cacheado.
Ventana de datos: no hay cron — la SC se evalúa lazy en cada composición sin cache hit.

---

## 8. Gotchas

- **`allowed_smart_collection_types` es load-bearing.** Sin él, o con más de un valor,
  el auto-scaffold no materializa y el slot va a `skipped_slots`. Si querés que Admin
  acepte varios tipos pero scaffoldee uno, sé específico igual.
- **Las SCs son por-website, no por-business.** Cada merchant (y cada website de un
  mismo negocio) recibe su propio set al instantiate; los cambios no se propagan.
- **SC borrada por el comercio.** El envelope llega con `meta.inactive: true,
  inactive_reason: "disabled"` o el slot queda `null`. Tolerá ambas:
  `!sc || sc.meta?.inactive`.
- **El publish validator NO valida `smart_collection_id`.** En S3 los slots están con
  marker `{ "_smart_collection_placeholder": "key" }` y se resuelven al instantiate.
  No te asustes si `template:publish` pasa sin "completar" valores SC.
- **`auto:<key>` solo es válido en `scaffold_sections`.** No es un valor de runtime.
- **`config.scaffold_origin: "auto"`** marca SCs creadas por auto-scaffold (debugging).
- **Cache de composición ≠ cache de SC.** Aunque pongas `cache_ttl: 0`, la composición
  que la envuelve sigue cacheada. Editar la SC (PATCH) invalida `cms:comp:*`.
- **Necesita catálogo poblado.** Sin productos/categorías/marcas el auto-scaffold se
  salta todo. Ver skill `seed-merchant-catalog`.

---

## 9. Endpoints útiles

| Acción | Endpoint |
|--------|----------|
| Crear SC manual (método C) | `POST /api/v1/admin/cms/smart-collections` |
| Listar SCs de un website | `GET /api/v1/admin/cms/smart-collections?website_id=…` |
| Auto-scaffold (método B) | `POST /api/v1/admin/cms/websites/{website_id}/auto-scaffold` |

## Skills relacionados

- `add-section` — crear el componente Astro / empty state que consume el envelope.
- `add-page` — declarar la página y sus scaffold_sections que referencian la SC.
- `seed-merchant-catalog` — poblar productos/categorías/marcas (requisito del auto-scaffold).

> Si trabajás dentro del monorepo Proxima, hay docs más detallados:
> `proxima-storefront-sdk/docs/12-smart-collections.md` (envelope completo, narrowing,
> cache, ladder), `proxima-api/docs/cms-website-structure.md` (envelope runtime +
> schedule), y `proxima-api/CLAUDE.md` → *Auto-scaffold de Smart Collections* (algoritmo).
> Si instalaste este skill via `proxima skills install`, este skill es autocontenido.
