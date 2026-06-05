# 04 — Sections y Attributes

Cómo definir, registrar y renderizar secciones. Contrato del golden template (`214store`).

---

## Tres capas del contrato

```
proxima.website.json
  section_types[].attribute_schema[]   ← qué campos existen (Builder)

API / composición
  section.values.{name}                ← valores del merchant (runtime)
  section.attributesMeta               ← meta inline-editing (Builder preview)

Storefront Astro
  SectionRenderer → props del componente
  getSectionAttr(attributesMeta)       ← builder-sdk
```

**Regla de oro:** `attribute_schema[].name` === prop del componente === key en `section.values`.

Guía de schema: [07-cms-attribute-schema.md](./07-cms-attribute-schema.md) · Modelo completo: [01-mental-model.md](./01-mental-model.md).

---

## Ciclo de vida de una sección

```
1. Diseño     → qué es editable vs fijo en código
2. Schema     → attribute_schema en proxima.website.json
3. Componente → Astro con props + empty-state contract
4. Registry   → SECTION_REGISTRY en SectionRenderer.astro
5. Shell      → si category=shell, render en SiteLayout (no en page sections)
6. Deploy     → proxima deploy
7. Builder    → EditableAttribute + attributesMeta (preview)
```

Skill recomendado: `proxima skills install add-section wire-cms-sections`

---

## Paso 1 — Schema en el manifiesto

Solo **`proxima.website.json`** (no archivos legacy separados):

```json
{
  "key": "cta_banner",
  "label": "Banner CTA",
  "category": "content",
  "attribute_schema": [
    {
      "name": "heading",
      "label": "Título",
      "type": "text",
      "localizable": true,
      "order": 1,
      "config": { "help_text": "Titular principal del banner." }
    },
    {
      "name": "cta",
      "label": "Botón",
      "type": "link",
      "order": 2
    },
    {
      "name": "products",
      "label": "Productos",
      "type": "smart_collection_id",
      "order": 3,
      "config": {
        "allowed_smart_collection_types": ["product_list"],
        "help_text": "Colección resuelta en composición."
      }
    }
  ]
}
```

Scaffold con defaults opcionales:

```json
{
  "section_type": "cta_banner",
  "order": 1,
  "default_values": {
    "heading": "Ofertas de la semana",
    "products": "auto:featured_products"
  }
}
```

---

## Paso 2 — Componente Astro (golden template)

```astro
---
import BuilderEmptyState from "@proxima-io/storefront-builder-sdk/BuilderEmptyState.astro";
import EditableAttribute from "@proxima-io/storefront-builder-sdk/EditableAttribute.astro";
import { getSectionAttr } from "@proxima-io/storefront-builder-sdk";

interface Props {
  cmsPreview?: boolean;
  attributesMeta?: Record<string, unknown>;
  heading?: string;
  cta?: { url?: string; label?: string; target?: string };
  products?: { items?: unknown[] };
}

const props = Astro.props;
const { key: attributeKey } = getSectionAttr(props.attributesMeta);
const heading = props.heading ?? "";
const items = props.products?.items ?? [];
const isEmpty = !heading && items.length === 0;

if (!props.cmsPreview && isEmpty) return null;
const showEmptyState = props.cmsPreview && isEmpty;
---

<section>
  {showEmptyState && <BuilderEmptyState sectionName="Banner CTA" />}
  {!showEmptyState && (
    <>
      <EditableAttribute meta={attributeKey("heading")} value={heading}>
        <h2>{heading}</h2>
      </EditableAttribute>
      {props.cta?.url && (
        <a href={props.cta.url}>{props.cta.label ?? "Ver más"}</a>
      )}
    </>
  )}
</section>
```

Props vienen de **`section.values`**, no de un objeto `section.attributes` genérico.

---

## Paso 3 — SectionRenderer

```astro
---
// SectionRenderer.astro (extracto)
{section.type === "cta_banner" && (
  <CtaBanner
    cmsPreview={cmsPreview}
    attributesMeta={section.attributesMeta}
    heading={section.values.heading as string}
    cta={section.values.cta as Props["cta"]}
    products={section.values.products as Props["products"]}
  />
)}
---
```

`SECTION_REGISTRY` mapea `section.type` → componente. El `key` del manifiesto debe coincidir.

---

## Shell vs page sections

| | Page section | Shell section |
|--|--------------|---------------|
| **Ejemplos** | hero_bento, product_grid | header, mega_menu, footer |
| **Manifiesto** | `pages[].scaffold_sections` | `shell_sections[]` |
| **Render** | SectionRenderer / views | SiteLayout.astro |
| **Defaults** | `default_values` por scaffold | `shell_default_values` global |

No declares header/footer en cada página.

---

## Overrides (presentación)

Arrays en `values` que fusionan sobre datos vivos — **no mutan catálogo**:

| Override | Sección | Uso |
|----------|---------|-----|
| `category_overrides` | mega_menu | badge, highlight, label_override, hidden sobre category tree API |
| `product_overrides` | hero_bento | tile size, badge, CTA por producto de la smart collection |

Pre-computar merge en frontmatter Astro (nunca block-body en `.map()` del template).

---

## Tipos de atributo en runtime

| Tipo | En `section.values` |
|------|---------------------|
| `text` / `rich_text` | string |
| `image` | URL string |
| `boolean` | boolean |
| `number` | number |
| `link` | `{ url, label?, target?, is_external? }` |
| `select` | string (value de opción) |
| `array` | `object[]` según `item_fields` |
| `smart_collection_id` | `{ type, items, meta }` ya resuelto |

Ver ejemplos de render en [05-smart-collections.md](./05-smart-collections.md) y selects/arrays en [07-cms-attribute-schema.md](./07-cms-attribute-schema.md).

---

## Campaign auto-detect — secciones promocionales sin pin manual

Secciones tipo `tech_hero_promo` / `flash_offers_band` que muestran una campaña
(badge + countdown + theme) **no se pinean por slug**. Auto-derivan el branding
desde el primer producto de su Smart Collection:

```ts
// En el frontmatter de la sección Astro
const items = (props.products_collection?.items ?? []) as ProductSummary[];
const autoCampaign = items[0]?.applied_promotion ?? null;

const targetAt = autoCampaign?.active_until;
const badge    = autoCampaign?.badge_text;
const theme    = autoCampaign?.theme_color;
```

Cada `ProductSummary` de la API trae un campo opcional `applied_promotion` con
la `Promotion` ganadora del pricing engine (ver `12-smart-collections.md` §5.5).

### Precedence sugerida (cuando declarás un `campaign_slug` como override)

Si la sección expone un attr `campaign_slug` (text) en su schema para que el
merchant fuerce una campaña específica, la chain canónica es:

```
1. items[0].applied_promotion     (auto-detect del SC)
2. fetchCampaignBySlug result     (pin manual via section attr)
3. section attrs legacy           (campaign_end_date, badge_text, ...)
```

### Por qué este patrón

- Crear/editar una `Promotion` en admin = el HOME se rebrandea solo.
- Sin riesgo de mismatch entre "campaña que descuenta el precio" y "campaña que
  se renderiza visualmente" — son la misma.
- Múltiples Promotions activas en paralelo (Black Week GLOBAL + Audio Week BRAND
  + Liquidación CATEGORY): cada producto recibe la suya por priority.

Referencias:
- [07-commerce.md](./07-commerce.md) § "Campañas y `applied_promotion`" — tipos
  TS + helpers `fetchCampaigns` / `fetchCampaignBySlug`.
- [12-smart-collections.md](./12-smart-collections.md) §5.5 — shape del campo
  en items + linked Promotion countdown.
- API canónica: `proxima-api/docs/commerce/promotions-campaigns.md`.

---

## Localización

`localizable: true` → la API resuelve al locale del website. En el storefront recibes un **string**, no un dict por idioma.

---

## Valores por defecto seguros

```ts
const heading = props.heading ?? "";
const items = (props.products?.items ?? []) as ProductSummary[];
```

En live, secciones vacías retornan `null` (empty-state contract). En Builder, `BuilderEmptyState`.

---

## Builder — tres wrappers

| Componente | Envuelve |
|------------|----------|
| `EditableSection` | Sección completa (selección en árbol) |
| `EditableAttribute` | Campo escalar |
| `EditableItem` | Item de un array |

Detalle: [06-builder-integration.md](./06-builder-integration.md).

---

## Checklist nueva sección

- [ ] `attribute_schema` en `proxima.website.json`
- [ ] Componente con `cmsPreview`, `attributesMeta`, empty-state
- [ ] Entrada en `SECTION_REGISTRY` + wiring de `section.values.*`
- [ ] Si aplica: `scaffold_sections` con `default_values`
- [ ] `proxima validate` → `proxima deploy`
- [ ] Inline editing probado con `?proxima_preview=1`
