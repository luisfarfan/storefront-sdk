# 07 — CMS attribute schema (manifiesto → Builder)

Cómo declarar en **`proxima.website.json`** la estructura que el **Builder** muestra al comercio. La API **persiste** el JSON del developer; no sustituye schemas por nombre de section type.

---

## Flujo

```
Developer escribe attribute_schema en proxima.website.json
        → proxima deploy
        → API guarda WebsiteSectionType.attribute_schema (por website)
        → Builder lee el schema y renderiza controles
        → section.values guarda los valores del merchant (p. ej. "flagship", no el label)
```

Normalización genérica en API (`item_schema` → `config.schema`, inferir `mode`): ver `proxima-api/docs/cms-attribute-schema.md`.

---

## Atributo de primer nivel

```json
{
  "name": "headline",
  "label": "Título",
  "type": "text",
  "order": 1,
  "localizable": true,
  "config": {
    "help_text": "Título principal visible sobre el hero."
  }
}
```

| Campo | Uso |
|-------|-----|
| `name` | Clave en `Section.values` y en el componente Astro |
| `label` | Etiqueta en el Builder |
| `type` | `text`, `rich_text`, `image`, `boolean`, `number`, `link`, `object`, `array`, `smart_collection_id`, `datetime` |
| `config` | Hints UI, schema anidado, límites numéricos, smart collection policy |

---

## `help_text` (campo)

- **Un solo string** que explica **para qué sirve el atributo**.
- **No** uses convenciones parseables tipo `"opciónA = descripción; opciónB = otra"` — el Builder no debe inferir opciones desde `help_text`.

```json
"help_text": "Tamaño de la celda en el grid bento (no es variante de SKU)."
```

---

## `options` (select y sugerencias)

### Formato recomendado — objetos

Cada opción define `value` (lo que se guarda) y `label` (lo que ve el comercio). Opcional `description` (tooltip).

```json
{
  "name": "variant",
  "label": "Tamaño en el grid",
  "type": "select",
  "help_text": "Tamaño del tile en el layout.",
  "options": [
    { "value": "flagship", "label": "Tile grande", "description": "Celda principal" },
    { "value": "standard", "label": "Tile mediano", "description": "Celdas secundarias" }
  ]
}
```

Valor en `Section.values`: `"flagship"` (siempre el `value`).

### Formato legado — strings

```json
"options": ["flagship", "standard"]
```

El label en UI = el mismo string. Válido cuando no necesitas copy distinto.

### Alternativa — `option_labels`

```json
"options": ["flagship", "standard"],
"option_labels": {
  "flagship": "Tile grande",
  "standard": "Tile mediano"
}
```

Preferir **array de objetos** para mantener value + label + description en un solo lugar.

### Texto con sugerencias (no enum)

`type: "text"` con `options` como objetos o strings: el comercio **puede escribir otro valor**; las options son atajos en el Builder.

---

## Arrays y overrides (`product_overrides`, etc.)

Usar `type: "array"` y schema explícito en `config`:

```json
{
  "name": "product_overrides",
  "label": "Overrides por producto",
  "type": "array",
  "config": {
    "ui": "hero_banner_item",
    "help_text": "Una fila por producto a personalizar.",
    "schema": {
      "mode": "array",
      "item_label": "Producto",
      "item_type": "object",
      "item_fields": [
        { "name": "product_id", "label": "Producto", "type": "product-picker" },
        {
          "name": "variant",
          "label": "Tamaño en el grid",
          "type": "select",
          "options": [
            { "value": "flagship", "label": "Tile grande" },
            { "value": "standard", "label": "Tile mediano" }
          ]
        }
      ]
    }
  }
}
```

Legacy: `config.item_fields` en deploy se convierte a `config.schema` (misma forma final).

---

## Select en atributo escalar con wrapper `schema`

Algunos atributos de primer nivel usan `type: "text"` + `config.schema.mode: "scalar"` para el editor:

```json
{
  "name": "variant",
  "label": "Tema visual",
  "type": "text",
  "config": {
    "help_text": "Paleta de la franja.",
    "schema": {
      "mode": "scalar",
      "fields": [
        {
          "name": "value",
          "label": "Tema visual",
          "type": "select",
          "options": [
            { "value": "neon", "label": "Neon", "description": "Fondo amarillo marca" }
          ]
        }
      ]
    }
  }
}
```

---

## Tipos de campo en `item_fields` / `fields`

| type | Uso |
|------|-----|
| `text`, `rich_text`, `number`, `boolean`, `image`, `link` | Escalares |
| `select` | Requiere `options` (string[] u objeto[]) |
| `product-picker` | ID de producto en catálogo |

---

## Referencia de implementación

| Recurso | Dónde |
|---------|--------|
| Golden example | `proxima-storefronts/apps/214store/proxima.website.json` |
| Guía por app | `proxima-storefronts/apps/214store/docs/CMS-ATTRIBUTES.md` |
| API (persistencia) | `proxima-api/docs/cms-attribute-schema.md` |
| Builder (inspector UI) | `proxima-builder/openspec/specs/cms-attribute-schema/spec.md` |
| OpenSpec API | `proxima-api/openspec/specs/cms-backend/spec.md` |

---

## `datetime` — Atributos de campaña / countdown

Permite que el comercio configure una fecha/hora de fin (o inicio) de campaña directamente desde el Builder.

```json
{
  "name": "campaign_end_date",
  "label": "Fin de campaña",
  "type": "datetime",
  "localizable": false,
  "config": {
    "help_text": "La sección se oculta automáticamente cuando se supere esta fecha."
  }
}
```

**Cómo lo persiste la API:** el valor se guarda en `Section.values` como un wrapper ISO UTC:

```json
{ "_": "2026-12-01T00:00:00Z" }
```

**`localizable: false`** siempre — una campaña tiene una sola fecha global por sección.

### Lectura en el componente Astro

El SDK provee helpers para extraer el target y calcular el tiempo restante.  
**El storefront decide 100% cómo renderizar** — no hay componente de UI en el SDK.

```astro
---
// src/components/sections/DealsHero.astro
import {
  resolveCampaignTarget,
  getCampaignCountdown,
} from "@proxima-io/storefront-core";

// 1. Extraer el target desde attributesMeta (viene de la API)
const targetAt = resolveCampaignTarget(props.attributesMeta, "campaign_end_date");

// 2. Snapshot SSR — seguro en servidor (no usa timers)
const snap = targetAt ? getCampaignCountdown(targetAt) : null;

// 3. En live: ocultar la sección si la campaña ya expiró
if (!props.cmsPreview && snap?.expired) return null;
---

{snap && !snap.expired && (
  {/* Cada storefront implementa su propia UI — Tailwind, CSS puro, lo que sea */}
  <div id="campaign-countdown" data-target={targetAt}>
    <span data-unit="hours">{snap.hours}</span>h
    <span data-unit="minutes">{snap.minutes}</span>m
    <span data-unit="seconds">{snap.seconds}</span>s
  </div>
)}
```

### Ticker client-side (actualización cada segundo)

Usar `createCampaignTicker` en un `<script>` del componente:

```astro
<script>
  import { createCampaignTicker } from "@proxima-io/storefront-core";

  const el = document.getElementById("campaign-countdown");
  const targetAt = el?.dataset.target;
  if (!el || !targetAt) return;

  const stop = createCampaignTicker(targetAt, (state) => {
    if (state.expired) {
      stop();
      el.closest("section")?.remove(); // o animar la salida
      return;
    }
    el.querySelector("[data-unit=hours]")!.textContent  = String(state.hours);
    el.querySelector("[data-unit=minutes]")!.textContent = String(state.minutes);
    el.querySelector("[data-unit=seconds]")!.textContent = String(state.seconds);
  });
</script>
```

### API en `storefront-core`

| Función | Para qué |
|---------|----------|
| `resolveCampaignTarget(attributesMeta, attrName)` | Extrae el ISO UTC de un attr `datetime` |
| `getCampaignCountdown(targetAt)` | Snapshot `{ days, hours, minutes, seconds, expired }` (SSR-safe) |
| `createCampaignTicker(targetAt, onTick)` | Ticker client-side, devuelve `stop()` |
| `resolveSmartCollectionTarget(sc)` | Extrae el target de `schedule.countdown_target_at` de una SC resuelta |

---

## Checklist para nuevos section types

- [ ] Cada campo editable tiene `label` y, si ayuda, `help_text` **del campo**
- [ ] Selects usan `options` estructuradas, no prose en `help_text`
- [ ] Overrides en `config.schema.item_fields` con `mode: "array"`
- [ ] Keys del manifiesto = keys en `SECTION_REGISTRY` del storefront
- [ ] `website-deploy` después de cambiar el schema
- [ ] Atributos `datetime` usan `localizable: false` y el componente lee con `resolveCampaignTarget()`
- [ ] Secciones con `datetime` manejan el caso `expired` en live (retornar `null`) y en Builder (mostrar placeholder)
