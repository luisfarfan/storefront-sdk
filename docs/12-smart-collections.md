# Smart Collections — guía end-to-end

Cómo declarar, scaffoldear, consumir y renderizar Smart Collections en un storefront Proxima.

Relacionados:

- Lifecycle del template (placeholders en S3, instantiate): `proxima-api/docs/cms-template-lifecycle.md`
- Estructura CMS (envelope runtime, schedule, countdown): `proxima-api/docs/cms-website-structure.md`
- Auto-scaffold algoritmo: `proxima-api/CLAUDE.md` (sección *Auto-scaffold de Smart Collections*)
- Tipos de atributos en runtime: `proxima-storefront-sdk/docs/11-attribute-types-runtime.md`
- Guía rápida previa: `proxima-storefront-sdk/docs/05-smart-collections.md`

---

## 1. Qué es una Smart Collection

Una **Smart Collection** (SC) es una "consulta guardada" que el storefront materializa
en items (`products`, `categories` o `brands`). No es una lista estática: es una
declaración de qué quieres mostrar — el orden, el filtro, el límite — que la API
ejecuta cada vez que se compone la página.

Características clave:

- Vive como fila en la tabla `cms_smart_collections`.
- Está **scoped a un `website_id`** (y por transitividad a un `business_id`).
- Tiene un `type` (`product_list`, `category_list`, `brand_list`, `manual`, `banner`, `search_preview`).
- Es **editable** por el comercio desde el Builder (no por el developer del template).
- El storefront **no la consume por slug**: la API la inyecta resuelta dentro de la
  composición de página (ver §4).

> **Mental model.** El template dice *"acá va una lista de productos destacados"*
> mediante un attribute de tipo `smart_collection_id`. La SC concreta — qué productos,
> qué orden, qué límite — la define el comercio (o la API en auto-scaffold). El
> storefront sólo lee la lista resuelta.

---

## 2. Tipos de Smart Collection

| `type` | Resuelve a | Config típico |
|--------|-----------|---------------|
| `product_list` | Lista de productos del catálogo | `sort`, `limit`, `filters`, `require_images` |
| `category_list` | Lista de categorías | `slugs`, `parent_slug`, `include_children`, `limit` |
| `brand_list` | Lista de marcas | `slugs`, `limit` |
| `manual` | Lista curada (IDs explícitos) | `product_ids[]` |
| `banner` | Contenido visual estático (no lista) | `media`, `cta` |
| `search_preview` | Preview de búsqueda dinámica | `query`, `limit` |

### 2.1 `product_list`

El tipo más usado. La API ejecuta el query contra el catálogo del negocio.

```json
{
  "type": "product_list",
  "config": {
    "sort": "newest",
    "limit": 8,
    "require_images": true,
    "filters": {
      "in_stock": true,
      "on_sale": false,
      "category_ids": [12],
      "brand_ids": [3],
      "category_slug": "tarjetas-video",
      "brand_slug": "asus",
      "featured": true
    }
  }
}
```

Valores conocidos de `sort`:

| `sort` | Significado |
|--------|-------------|
| `newest` | Ordena por `created_at DESC` |
| `best_sellers` | Ordena por unidades vendidas (requiere historial de órdenes) |
| `price_asc` / `price_desc` | Por precio efectivo |
| `manual` | Respeta el orden de `product_ids` |

Filtros disponibles dependen del catálogo; los más comunes son `in_stock`, `on_sale`,
`featured`, `category_ids[]`, `brand_ids[]`. El auto-scaffold (§3.B) usa
`category_ids` y `on_sale` para armar candidatos.

### 2.2 `category_list`

```json
{
  "type": "category_list",
  "config": {
    "include_children": true,
    "parent_slug": "componentes",
    "limit": 6
  }
}
```

Resuelve a categorías visibles del negocio. Útil para `category_grid` o un strip
"explorá por categoría".

### 2.3 `brand_list`

```json
{
  "type": "brand_list",
  "config": { "limit": 8, "slugs": ["asus", "msi", "gigabyte"] }
}
```

Resuelve a marcas activas con productos en stock. Sirve para una franja de logos.

### 2.4 `manual`

Lista 100% curada por el comercio desde Admin. Útil cuando el merchant quiere
control total y no le importa que el query "se desactualice".

### 2.5 `banner` y `search_preview`

`banner` no resuelve a una lista — es un slot visual gestionado vía SC para
aprovechar la ventana `active_from` / `active_until`. `search_preview` es un
preview dinámico contra el endpoint de búsqueda (poco usado en templates default).

---

## 3. Tres formas de crear una Smart Collection

Hay tres caminos para que una SC llegue a existir en la base de datos del comercio.
Cada uno responde a un momento distinto del lifecycle.

### A. Placeholders del developer en el manifest

> **Cuándo.** El developer del template **sabe desde el día 1** qué SCs necesita
> (ej. "todos los productos", "ofertas", "destacados"). Quiere que cada merchant
> que adquiera el template arranque con esas mismas SCs ya creadas.

#### Declarar el placeholder

En `proxima.website.json`, en la raíz del manifest:

```json
{
  "smart_collection_placeholders": {
    "featured_products": {
      "name": "Productos destacados",
      "type": "product_list",
      "contract_type": "product_list",
      "config": { "filter": "featured" },
      "cache_ttl": 300
    },
    "on_sale_products": {
      "name": "Productos en oferta",
      "type": "product_list",
      "config": { "filter": "on_sale" },
      "cache_ttl": 300
    },
    "brands": {
      "name": "Marcas del catálogo",
      "type": "brand_list",
      "config": {},
      "cache_ttl": 600
    }
  }
}
```

Campos por placeholder:

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `type` | Sí | `product_list \| category_list \| brand_list \| manual \| banner` |
| `name` | Recomendado | Etiqueta que verá el comercio en Admin (default: la key) |
| `config` | No | Config inicial de la SC |
| `contract_type` | No | Hint para validadores; típicamente igual a `type` |
| `cache_ttl` | No | TTL en segundos (default 300) |
| `is_active` | No | Default `true` |
| `instantiate_config` | No | Override fino: puede contener `config`, `cache_ttl`, `contract_type`, `is_active` que ganan sobre los anteriores |

#### Referenciar el placeholder desde una sección

En `scaffold_sections[].values`, usa el prefijo `auto:`:

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

`auto:<key>` es la forma legible que escribe el developer. Durante el flujo
`/template:publish`, el templateizer la transforma a la forma canónica que se
almacena en S3:

```json
{ "hero_products": { "_": { "_smart_collection_placeholder": "featured_products" } } }
```

Ese formato `{ "_smart_collection_placeholder": "key" }` es el marker que la API
sustituye al instantiate.

#### Instantiate (cuando el comercio adquiere el template)

`CMSService._instantiate_template_smart_collection_placeholders` recorre el dict
`smart_collection_placeholders` y para cada entrada:

1. Crea una fila `SmartCollection` con `website_id` del merchant, el `type`,
   `name`, `config`, `cache_ttl` y `contract_type` declarados.
2. Acumula el mapping `{ "featured_products": 42, "on_sale_products": 43, ... }`.

Luego, al instanciar cada sección, `_replace_smart_collection_placeholders` recorre
los `values` y sustituye cada `{ "_smart_collection_placeholder": "featured_products" }`
por el ID entero `42`.

El resultado: cada merchant tiene **sus propias SCs**, completamente independientes
de cualquier otro tenant, ya cableadas a las secciones del template.

#### Cuándo usar placeholders

- Necesitás SCs con nombres específicos visibles en Admin del comercio.
- Querés controlar `cache_ttl` o `contract_type` por SC.
- Tenés más de una sección apuntando a la misma SC (ej. `hero_products` y
  `product_rail` que reutilizan `featured_products`) — el placeholder garantiza
  que ambas secciones reciben el mismo ID.

### B. Auto-scaffold data-aware

> **Cuándo.** El template no quiere prescribir qué SCs crear; quiere que la API
> elija la mejor configuración **mirando el catálogo real** del comercio. Útil
> para templates genéricos que se adaptan a "tienda con catálogo pequeño" vs
> "tienda con miles de SKUs y ofertas activas".

#### Endpoint

```
POST /api/v1/admin/cms/websites/{website_id}/auto-scaffold
```

Scope requerido: `cms:websites:write`. Hook opcional durante deploy:

```
POST /api/v1/admin/cms/websites/deploy?auto_scaffold=true
```

#### Algoritmo (resumen)

Detalle completo en `proxima-api/CLAUDE.md` → *Auto-scaffold de Smart Collections*.

1. **Guard first-run.** Si el website ya tiene ≥1 SC → `skipped: true,
   reason: "collections already exist"`. No hay `?force`. La idea: idempotente y
   no destructivo.
2. **Catalog readiness gate.** Cuenta productos, categorías, marcas, on_sale,
   con imagen. Si `products + categories + brands == 0` → `skipped: true,
   reason: "catalog_empty"`. Sin catálogo no hay nada para resolver.
3. **Recorre pages → sections** y, por cada sección, resuelve su `attribute_schema`
   (la `WebsiteSectionType` del website prevalece sobre el catálogo global).
4. **Por cada attribute `type: "smart_collection_id"` vacío**, mira el `config`:
   - El schema debe declarar exactamente **un** valor en
     `allowed_smart_collection_types`. Si declara cero o varios → skip con
     `reason: "ambiguous_type"`.
5. **`product_list` — priority ladder.** Construye candidatos de genérico a
   específico (`scaffold_catalog.build_product_list_candidates`):

   | Tier | Candidato | Requiere |
   |------|-----------|----------|
   | 0 | `{ sort: newest, limit }` | siempre |
   | 1 | `+ require_images: true` | `products_with_images ≥ min_items` |
   | 1 | `+ filters.in_stock: true` | `products ≥ min_items` |
   | 1 | `+ filters.category_ids: [top]` | `top_category_id` no nulo |
   | 2 | `sort: best_sellers` | `products_with_sales ≥ min_items` |
   | 2 | `filters.on_sale: true` | `products_on_sale ≥ min_items` |

   El nombre del placeholder añade *bias*: keys que matchean `/promo|flash|sale/`
   adelantan candidatos `on_sale`; `/best|seller|top/` adelantan `best_sellers`;
   `/new|arrival/` ancla `newest` al frente.

   La API ejecuta un preview de cada candidato y se queda con el **primero** cuyo
   `preview_count >= min_items` (default 1; override con `attribute.config.scaffold_min_items`).

6. **`category_list` / `brand_list`.** Skip si el count de la entidad es 0 o el
   preview no alcanza `min_items`.
7. **`banner`.** Crea SC inactiva (`is_active: false`) — el comercio la activa
   manualmente cuando suba media.
8. **`manual`.** Skip (no hay forma data-aware de elegir IDs).
9. **Secciones campaña.** Si la sección tiene `category: "campaign"` o el schema
   declara `countdown_ends_at` + un slot SC, seedea:
   - `section.values.show_countdown = true`
   - `section.values.countdown_ends_at = now + 14 días UTC`
   - SC `active_until = now + 14 días UTC`
   - SC `config.display.countdown_target_at = same ISO`

   Así la campaña arranca lista para renderizar con countdown y ventana de datos
   sincronizadas.
10. **Slots editoriales** (array de overrides, text) → **nunca se tocan**.
11. Toda SC creada lleva `config.scaffold_origin = "auto"` como marker.

#### Respuesta

```json
{
  "catalog_readiness": {
    "products": 184,
    "categories": 12,
    "brands": 9,
    "products_with_images": 178,
    "products_on_sale": 23,
    "products_with_sales": 41
  },
  "created": [
    {
      "smart_collection_id": 42,
      "type": "product_list",
      "placeholder_key": "hero_products",
      "preview_count": 8,
      "config_summary": { "sort": "newest", "limit": 8, "require_images": true }
    }
  ],
  "skipped_slots": [
    { "section_id": 17, "attr": "manual_collection", "reason": "type=manual" }
  ],
  "warnings": []
}
```

#### Placeholders vs auto-scaffold

| Pregunta | Respuesta |
|----------|-----------|
| ¿Sabés exactamente qué SCs querés desde el día 1? | Usa **placeholders** |
| ¿Querés que la API elija sort/filters mirando el catálogo? | Usa **auto-scaffold** |
| ¿Querés ambos? | Sí: los placeholders se crean al instantiate; después corres `/auto-scaffold` para llenar slots que el template dejó vacíos. La guard first-run hace que el segundo paso no toque las SCs ya creadas — solo las faltantes serían procesadas si pasaras `?force` (no implementado a propósito; si necesitás llenar slots restantes, llamá manualmente desde Admin) |

### C. Manual desde Admin / Builder

```
POST /api/v1/admin/cms/smart-collections
{
  "website_id": "...",
  "business_id": "...",
  "type": "product_list",
  "name": "Black Week Top Picks",
  "config": { "sort": "newest", "filters": { "on_sale": true }, "limit": 12 },
  "active_from": "2026-11-20T00:00:00Z",
  "active_until": "2026-11-30T23:59:59Z",
  "cache_ttl": 300
}
```

Y desde el Builder el comercio puede asignar la SC a un slot `smart_collection_id`
de una sección con un picker. Es el camino que cubre todo lo que los dos anteriores
no resuelven: campañas one-off, listas curadas, swaps temporales.

---

## 4. Composición pública (runtime envelope)

Cuando el storefront pide la composición de una página, **cada `smart_collection_id`
guardado en `section.values` se reemplaza por un envelope resuelto**. El storefront
nunca ve el ID raw — ve el envelope.

```json
{
  "type": "product_list",
  "items": [
    {
      "id": 901,
      "slug": "rtx-4080-asus-tuf",
      "name": "RTX 4080 ASUS TUF",
      "image_url": "https://cdn…/rtx-4080.webp",
      "price": { "amount": "5499.00", "currency": "PEN" },
      "compare_at_price": { "amount": "5999.00", "currency": "PEN" },
      "in_stock": true
    }
  ],
  "meta": {
    "count": 8,
    "inactive": false,
    "inactive_reason": null
  },
  "collection": {
    "id": 42,
    "website_id": "ws_…",
    "name": "Hero products",
    "type": "product_list",
    "contract_type": "product_list",
    "is_active": true,
    "active_from": null,
    "active_until": "2026-11-30T23:59:59Z",
    "cache_ttl": 300,
    "config": {
      "sort": "newest",
      "limit": 8,
      "require_images": true,
      "display": { "countdown_target_at": "2026-12-01T00:00:00Z" }
    }
  },
  "schedule": {
    "data_window": {
      "from": null,
      "until": "2026-11-30T23:59:59Z"
    },
    "countdown_target_at": "2026-12-01T00:00:00Z",
    "countdown_target_source": "config.display.countdown_target_at"
  }
}
```

### Campos del envelope

| Campo | Significado |
|-------|-------------|
| `type` | Espejo de `collection.type`. Sirve para *narrowing* en TypeScript |
| `items` | Lista resuelta. Vacía si SC inactiva o sin matches |
| `meta.count` | `items.length`. Útil para mostrar "X productos" sin contar |
| `meta.inactive` | `true` cuando la SC no debe renderizar |
| `meta.inactive_reason` | Causa de `inactive: true` (ver tabla abajo) |
| `collection` | Fila SC sin secretos. `name` es etiqueta de Admin — **no** uses como H1 |
| `schedule.data_window` | `{ from, until }` derivado de `active_from` / `active_until` |
| `schedule.countdown_target_at` | ISO 8601 UTC del target del countdown (puede ser null) |
| `schedule.countdown_target_source` | De dónde vino el target |

### `inactive_reason`

| Valor | Causa |
|-------|-------|
| `disabled` | `collection.is_active = false` (el comercio la apagó en Admin) |
| `before_start` | `now < active_from` |
| `after_end` | `now > active_until` |

Cuando `meta.inactive === true`, `items` es **siempre `[]`**. Es responsabilidad
del renderer decidir si esconde la sección, muestra un empty state, o renderiza
un fallback con copy de la sección sin la lista.

### `countdown_target_source`

| Valor | Significado |
|-------|-------------|
| `config.display.countdown_target_at` | Override explícito en `config.display` |
| `active_until` | Derivado automáticamente del fin de ventana de datos |
| `section_attribute` | Sólo aparece en `attributes_meta` de un attr `datetime`, no en envelope SC |

---

## 5. Ventanas activas y countdown

`active_from` y `active_until` son las palancas para campañas con vencimiento.

### Lazy evaluation

No hay cron. La SC no se "apaga" en BD cuando cruza `active_until`. Lo que pasa es
que el siguiente request de composición que no tenga cache hit:

1. Compara `now` contra `active_from` / `active_until`.
2. Si está fuera de ventana, retorna `items: []` + `meta.inactive: true` +
   `inactive_reason`.

Para que el storefront refleje el cambio inmediato, hay que invalidar el cache
(ver §6) o esperar a que expire el TTL.

### Diseño de campañas con countdown

El patrón canónico para una sección de campaña (`tech_hero_promo`, `flash_offers_band`):

1. El section type declara dos slots en su schema:
   - `countdown_ends_at: datetime` (cuándo termina la promo, lo edita el comercio)
   - `products_collection: smart_collection_id` con
     `config.allowed_smart_collection_types: ["product_list"]`
2. La SC tiene `active_until` igual al countdown_ends_at, o `config.display.countdown_target_at` explícito.
3. El storefront prioriza el target así:
   1. `attributes_meta.<datetime_attr>.schedule.countdown_target_at` (editorial)
   2. `attributes.<sc_attr>.schedule.countdown_target_at` (SC)
4. Cuando `now > target` el cliente puede ocultar el componente o cambiar copy;
   el envelope SC además entrega `meta.inactive: true, inactive_reason: "after_end"`.

---

## 6. Cache

| Capa | TTL | Invalidación |
|------|-----|--------------|
| SC `cache_ttl` | Default 300s | Editar la SC borra `cms:comp:*` |
| Composition cache Redis (`cms:comp:v5:{website}:{business}:{path}:{locale}`) | Por TTL más corto de los componentes | PATCH a sección, PATCH a SC, deploy de section_types |

La API es responsable de invalidar — el storefront sólo debe asumir que tras una
edición en Admin **hay latencia de hasta `cache_ttl` segundos** antes de ver el
cambio. Para el preview en Builder se usa un bypass con header/cookie de admin.

---

## 7. Cómo consumir desde un storefront

### A. Como parte de la composición de página

El storefront recibe el envelope ya resuelto en `section.attributes.<slot>`:

```ts
import type { Composition, ProductListEnvelope } from "@proxima-io/storefront-core";

const heroSection = composition.sections.find((s) => s.section_type === "tech_hero_promo");
if (!heroSection) return null;

const hero = heroSection.attributes.hero_products as ProductListEnvelope;

if (hero.meta.inactive) {
  // Render fallback: solo eyebrow + heading, sin grid de productos.
  return <HeroEmpty reason={hero.meta.inactive_reason} />;
}

return (
  <Hero
    title={heroSection.attributes.heading}
    products={hero.items}
    badge={heroSection.attributes.badge_text}
  />
);
```

> **Patrón clave.** El storefront nunca llama un endpoint de SC por slug. Toda la
> resolución ya ocurrió server-side. Esto reduce roundtrips y garantiza
> consistencia: el countdown, el grid y el copy provienen del mismo snapshot.

### B. Render con countdown desde la SC

```ts
import {
  resolveSmartCollectionTarget,
  getCampaignCountdown,
} from "@proxima-io/storefront-core";

const sc = section.attributes.products_collection;

// Prioridad: section attribute datetime → SC schedule → null
const targetAt =
  section.attributes_meta?.campaign_end_date?.schedule?.countdown_target_at ??
  resolveSmartCollectionTarget(sc);

const countdown = targetAt ? getCampaignCountdown(targetAt) : null;

return (
  <FlashOffers
    products={sc.items}
    countdown={countdown}
    inactive={sc.meta.inactive}
  />
);
```

`getCampaignCountdown` corre en el cliente para evitar drift entre el reloj del
servidor cacheado y el reloj del usuario.

### C. Empty state en Builder vs live

El storefront recibe un flag `cmsPreview` (ver `docs/06-builder-integration.md`):

```tsx
function ProductRail({ section, cmsPreview }: Props) {
  const collection = section.attributes.products_collection;

  if (!collection || collection.meta.inactive) {
    if (cmsPreview) {
      return <EmptySlotPlaceholder slot="products_collection" />;
    }
    return null; // En live, esconder silenciosamente
  }

  return <Rail items={collection.items} />;
}
```

`EmptySlotPlaceholder` es un componente que el Builder usa como target del picker:
clic → abre el modal para asignar/crear una SC. En live no aporta nada y debe
desaparecer.

### D. Narrowing por tipo

Cada envelope tiene un campo `type` espejo del de la SC. En TypeScript:

```ts
type SmartCollectionEnvelope =
  | ProductListEnvelope
  | CategoryListEnvelope
  | BrandListEnvelope
  | ManualEnvelope
  | BannerEnvelope;

function isProductList(env: SmartCollectionEnvelope): env is ProductListEnvelope {
  return env.type === "product_list";
}
```

Esto permite que un mismo componente reciba `smart_collection_id` y ramifique
según el tipo (útil para slots que aceptan más de un `allowed_smart_collection_types`).

---

## 8. Patrones comunes

| Patrón | Tipo | Config recomendado |
|--------|------|--------------------|
| Featured hero / above-the-fold | `product_list` | `sort: newest`, `require_images: true`, `limit: 4–8` |
| Best sellers rail | `product_list` | `sort: best_sellers`, `limit: 8–12` |
| Recién llegados | `product_list` | `sort: newest`, `filters: { in_stock: true }`, `limit: 8` |
| Ofertas relámpago | `product_list` | `sort: newest`, `filters: { on_sale: true }`, `active_until: campaign_end`, `config.display.countdown_target_at` |
| Categoría destacada | `product_list` | `sort: newest`, `filters: { category_ids: [X] }`, `limit: 8` |
| Grid de categorías | `category_list` | `limit: 6`, `include_children: true` |
| Franja de marcas | `brand_list` | `limit: 8` (o `slugs` curados) |
| Listado de PLP catálogo | `product_list` | `sort: newest`, `limit: 24` (paginación cliente) |
| Listado relacionados PDP | `product_list` | `sort: best_sellers`, `limit: 6` (filtros vía override de página) |

---

## 9. Gotchas

- **`allowed_smart_collection_types` es load-bearing.** Si el `attribute_schema` no
  lo declara, o declara más de un valor, el auto-scaffold no sabe qué tipo crear y
  va a la lista de `skipped_slots`. Si querés que un slot acepte varios tipos en
  Admin pero scaffoldee uno por default, ponete específico en el schema.
- **Las SCs son por-website, no por-business.** Cada merchant que adquiere un
  template recibe **su propio set** de SCs creadas al instantiate. Si un negocio
  tiene 3 websites, tiene 3 sets independientes — los cambios no se propagan.
- **`collection.name` es etiqueta de Admin.** Nunca la rendericés como H1 ni copy
  visible al comprador. El título de la sección vive en `section.attributes.title`
  (o equivalente, definido por el schema).
- **SC borrada por el comercio.** Si el merchant elimina una SC desde Admin, la
  sección queda con `attributes.<slot> = null` o el envelope llega con
  `meta.inactive: true, inactive_reason: "disabled"` (depende del flujo). El
  storefront debe tolerar ambas formas: chequear `!sc || sc.meta?.inactive`.
- **El templateizer NO valida `smart_collection_id` requeridos.** Es correcto: en
  el snapshot S3 los slots están con marker `{ "_smart_collection_placeholder":
  "key" }` y se resuelven al instantiate. No te asustes si `template:publish`
  pasa sin "completar" valores SC.
- **`auto:<key>` solo es válido en `scaffold_sections`.** No es un valor genérico
  que puedas escribir en runtime. Es exclusivamente el azúcar del manifest para
  declarar referencias a placeholders.
- **`config.scaffold_origin: "auto"`** es un breadcrumb. Si lo ves en una SC en
  prod, la creó el auto-scaffold; si está ausente, fue placeholder o creación
  manual. Útil para debugging y para Admin (puede mostrar un badge "auto").
- **El bias del nombre de placeholder importa.** `featured_products` y
  `top_sellers` van por caminos distintos del ladder. Nombrar tus placeholders
  con keywords como `flash`, `promo`, `sale`, `best`, `seller`, `new`, `arrival`
  da hints al auto-scaffold para que elija mejor.
- **Cache de composición ≠ cache de SC.** Aunque pongas `cache_ttl: 0` en la SC,
  la composición que la envuelve sigue cacheada por su propio TTL. Para forzar
  refresh, editar la SC (PATCH) que invalida `cms:comp:*` patterns.

---

## 10. Referencias rápidas

| Tarea | Lugar |
|-------|-------|
| Declarar placeholder en template | `proxima.website.json` → `smart_collection_placeholders` |
| Referenciar placeholder en sección | `scaffold_sections[].values.<attr> = { "_": "auto:<key>" }` |
| Endpoint auto-scaffold | `POST /api/v1/admin/cms/websites/{id}/auto-scaffold` |
| Endpoint deploy + auto-scaffold | `POST /api/v1/admin/cms/websites/deploy?auto_scaffold=true` |
| Crear SC manual | `POST /api/v1/admin/cms/smart-collections` |
| Listar SCs de un website | `GET /api/v1/admin/cms/smart-collections?website_id=…` |
| Editar SC | `PATCH /api/v1/admin/cms/smart-collections/{id}` |
| Composición storefront | `GET /api/v1/storefront/composition?path=…&locale=…` |
| Implementación envelope (server) | `proxima-api/src/modules/cms/application/smart_collection_composition.py` |
| Algoritmo scaffold (server) | `proxima-api/src/modules/cms/application/scaffold_catalog.py` |
| Tests envelope | `tests/unit/cms/test_smart_collection_composition.py` |
| Tests countdown integración | `tests/integration/api/test_cms_campaign_countdown_composition_api.py` |
| Tests auto-scaffold API | `tests/integration/api/test_website_auto_scaffold_api.py` |
