# Tipos de atributos CMS — runtime reference

Cómo se declara, guarda, resuelve y renderiza cada tipo de atributo. Referencia exhaustiva.

> Para el modelo de datos general y el contrato del Builder, ver:
> - `proxima-api/docs/cms-attribute-schema.md` (normalización y persistencia)
> - `proxima-api/docs/cms-website-structure.md` (modelo de datos + composición pública)
>
> Este doc es la referencia **runtime** complementaria: cómo cada tipo se desenvuelve y consume desde un storefront.

---

## Índice

Tipos válidos como **atributo de primer nivel** (`attribute_schema[]` en el manifiesto y aceptados por `POST /admin/cms/websites/deploy`):

`text` · `rich_text` · `image` · `boolean` · `number` · `datetime` · `link` · `object` · `array` · `smart_collection_id`

Tipos **solo válidos dentro de `item_fields` / `fields`** (Builder-only): `select` · `product-picker`.

Catálogo vivo: `GET /api/v1/admin/cms/attributes/types` · UI kinds: `GET /api/v1/admin/cms/attributes/ui-kinds`.

---

## Fundamentos compartidos

### Wrappers de persistencia en `Section.values`

| `localizable` | Forma persistida |
|---------------|------------------|
| `true`        | `{ "es": <valor>, "en": <valor> }` — una clave por locale BCP-47 |
| `false`       | `{ "_": <valor> }` — clave reservada para el único valor |

`PATCH /api/v1/admin/cms/sections/{id}` normaliza al wrapper correcto según el `attribute_schema` de la website.

### Cadena de resolución del locale (composición pública)

`_extract_localized_attribute_value` (en `use_cases.py:5250`) ordena los candidates así:

1. **Locale solicitado** por la query (`?locale=es`, normalizado).
2. **Locale por defecto del negocio** (`_get_default_locale_for_business`).
3. **Primer valor disponible** en el dict (`next(iter(value.values()))`).

Para no-localizables existe un atajo: si el dict trae `"_"`, se devuelve directamente.

### Recursión en `object` / `array`

`resolve_field_tree_for_composition` (en `composition_attribute_resolution.py`) recorre tipos contenedores. Para cada hijo declarado en `item_fields` / `fields`:

- Llama a `_unwrap_localized_value` con la `localizable` flag del **hijo** (no del padre).
- Pasa los mismos `locale_candidates` (fix de mayo 2026; antes el hijo recibía `{"es": "..."}` y el storefront renderizaba `[object Object]`).
- Si el hijo es a su vez `object` o `array`, recursa.
- Si el hijo es `smart_collection_id`, lo reemplaza por el envelope resuelto.

### Forma del bloque `attributes_meta`

`composition_meta_for_attribute` genera por cada atributo:

```json
{
  "attribute_key": "headline",
  "name": "headline",
  "label": "Título",
  "type": "text",
  "order": 1,
  "localizable": true
}
```

Solo `datetime` añade `schedule` (`countdown_target_at`, `countdown_target_source`, `data_window`).

### Validador del publish

`section.values` con dict vacío `{}` o `null` cuenta como **ausente**. Atributos `is_required: true` con valor ausente bloquean el publish. `smart_collection_id` es la única excepción: placeholders `{"_smart_collection_placeholder": "<key>"}` saltan el chequeo porque se rellenan en `instantiate`.

---

## `text`

Texto plano corto.

**Declaración:**
```json
{
  "name": "headline",
  "label": "Título",
  "type": "text",
  "order": 2,
  "localizable": true,
  "is_required": true,
  "config": {
    "help_text": "Máximo 60 caracteres recomendado",
    "options": [
      { "value": "default", "label": "Estándar" },
      { "value": "compact", "label": "Compacto" }
    ]
  }
}
```

**Storage en `Section.values`:**
- Localizable: `{ "es": "Bienvenidos", "en": "Welcome" }`
- No localizable: `{ "_": "default" }`

**Composición runtime:**
- Top-level: `_extract_localized_attribute_value` selecciona el locale (cadena `locale → default locale → first available`) y devuelve un **string plano**.
- Anidado dentro de `object` / `array`: `_unwrap_localized_value` aplica la misma cadena usando la `localizable` del hijo.

**Storefront recibe:** `string` (o `undefined` si la sección no tiene el valor).

**Builder UI:**
- Default: `TextFieldEditor` (input simple).
- Con `config.options` (`[{ value, label, description? }]` o `string[]` legado): `<select>`.
- UI kinds alternativos: `textarea`, `slug`, `color`.

**Gotchas:**
- `[object Object]` renderizado en pantalla → el hijo en `item_fields` no incluyó `localizable: true` cuando debía, o se desplegó una versión de API anterior al fix de mayo 2026 del `locale_candidates` recursivo.
- `config.help_text` es **descripción**, no fuente de opciones. No uses `"A = descripción; B = otra"` — declara `options` estructurado.
- El validador trata `""` y `{}` como ausentes para `is_required`.
- `value_shape` documental: `"string"`.

---

## `rich_text`

HTML formateado o salida del editor.

**Declaración:**
```json
{
  "name": "copy",
  "label": "Descripción",
  "type": "rich_text",
  "order": 3,
  "localizable": true,
  "is_required": true
}
```

**Storage:**
- Localizable: `{ "es": "<p>Hola</p>", "en": "<p>Hi</p>" }`
- No localizable: `{ "_": "<p>...</p>" }`

**Composición runtime:** idéntico a `text`. La API **no sanitiza** ni transforma HTML; lo devuelve tal cual fue guardado por el Builder.

**Storefront recibe:** `string` con HTML. El consumer es responsable de:
- Renderizarlo con `set:html` (Astro) / `dangerouslySetInnerHTML` (React).
- Sanitizar si no confías 100% en el origen.

**Builder UI:** `RichTextEditor` (toolbar configurable vía `config.toolbar`).

**Gotchas:**
- La cadena de fallback de locale es la misma que `text`. Si el `en` está vacío y el `es` tiene contenido, una request con `?locale=en` devolverá el `es` (después del default del negocio).
- Para texto plano sin formato usa `text`; `rich_text` siempre dispara el editor enriquecido en el Builder.

---

## `image`

URL de imagen o referencia a media record.

**Declaración:**
```json
{
  "name": "hero_image",
  "label": "Imagen hero",
  "type": "image",
  "order": 1,
  "localizable": false,
  "config": {
    "folders": ["hero", "marketing"],
    "accept": ["image/jpeg", "image/png", "image/webp"]
  }
}
```

**Storage — dos formas válidas:**

1. **URL plana** (compatibilidad con campos tipo `image_url`):
   ```json
   { "_": "https://cdn.proxima.pe/hero.jpg" }
   ```
2. **Media record completo** (cuando el Builder sube un asset):
   ```json
   {
     "_": {
       "url": "https://cdn.proxima.pe/hero.jpg",
       "alt": "Producto destacado",
       "width": 1920,
       "height": 1080
     }
   }
   ```

> **Nota importante sobre `image_url` en otros endpoints:** los endpoints de catálogo (`GET /storefront/products/{id}`) devuelven `image_url` como **string plano**, NO como `{ small, medium, large }`. No mezcles esa expectativa con atributos CMS: el shape lo dicta cómo se subió.

**Composición runtime:**
- Top-level: unwrap normal del wrapper localizable/no-localizable. El valor desenvuelto se devuelve tal cual (string o dict).
- No hay procesamiento de variantes en la API: lo que guardaste es lo que recibes.

**Storefront recibe:** `string` o `{ url, alt?, width?, height? }`. Conviene normalizar en el adapter:

```ts
const src = typeof img === "string" ? img : img?.url;
const alt = typeof img === "string" ? "" : img?.alt ?? "";
```

**Builder UI:**
- `image` → `MediaEditor` (picker + upload).
- `image_with_ai` → `MediaAiEditor` (con acciones de generación AI).

**Gotchas:**
- Localizable solo si tu storefront realmente usa imágenes distintas por idioma (banners traducidos). Default razonable: `false`.
- `alt` traducible: requiere modelar como `object` localizable con `url` no-localizable y `alt` localizable. Más simple: imagen no-localizable + atributo `text` separado para el alt.

---

## `boolean`

Toggle on/off.

**Declaración:**
```json
{
  "name": "show_compare",
  "label": "Mostrar comparar",
  "type": "boolean",
  "order": 7
}
```

`localizable` por convención `false` (carece de sentido).

**Storage:** `{ "_": true }` o `{ "_": false }`.

**Composición runtime:** unwrap directo del wrapper `"_"` → devuelve `true` / `false`.

**Storefront recibe:** `boolean` o `undefined` si nunca se setteó.

**Builder UI:** `BooleanFieldEditor` (switch).

**Gotchas:**
- `value === undefined` no es lo mismo que `false`. Default explícitamente:
  ```ts
  const showCompare = props.show_compare ?? false;
  ```
- En `item_fields` de un `array`, los booleanos viajan sin wrapper porque cada item es un dict directo (`{ icon: "...", highlight: true }`).

---

## `number`

Valor numérico.

**Declaración:**
```json
{
  "name": "low_stock_threshold",
  "label": "Umbral bajo stock",
  "type": "number",
  "order": 5,
  "config": {
    "help_text": "PDP: alerta cuando stock ≤ este valor.",
    "min": 0,
    "max": 100,
    "step": 1
  }
}
```

**Storage:** `{ "_": 42 }`. JSONB acepta ints y floats.

**Composición runtime:** unwrap directo.

**Storefront recibe:** `number` o `undefined`.

**Builder UI:**
- `number` → `NumberFieldEditor`.
- `range` → `RangeEditor` (slider, mismas keys de config).

**Gotchas:**
- Si el operador deja el input vacío, el Builder guarda `null` o no escribe la key — siempre default en el consumer (`?? 0`).
- `localizable: true` está permitido pero rara vez tiene sentido. Mejor declarar dos atributos.

---

## `datetime`

Timestamp ISO-8601 UTC para scheduling y countdowns.

**Declaración:**
```json
{
  "name": "campaign_ends_at",
  "label": "Fin de campaña",
  "type": "datetime",
  "localizable": false,
  "order": 1
}
```

> `datetime` es **obligatoriamente no localizable**. El control en el Builder es `DateTimeFieldEditor`.

**Storage:** `{ "_": "2026-12-01T00:00:00Z" }`. El PATCH acepta cualquier ISO-8601 con offset y rechaza strings no parseables (HTTP 400).

**Composición runtime:**
- `normalize_datetime_attribute_value` parsea y reformatea a ISO-8601 UTC con sufijo `Z`.
- `composition_meta_for_attribute` añade un bloque `schedule`:
  ```json
  "attributes_meta": {
    "campaign_ends_at": {
      "type": "datetime",
      "schedule": {
        "countdown_target_at": "2026-12-01T00:00:00Z",
        "countdown_target_source": "section_attribute",
        "data_window": { "from": null, "until": "2026-12-01T00:00:00Z" }
      }
    }
  }
  ```

**Storefront recibe:** `string` ISO. Para countdowns usa `resolveCampaignTarget()` del paquete `storefront-core` (lee `attributesMeta.<name>.schedule.countdown_target_at` y cae al valor crudo si falta):

```ts
import { resolveCampaignTarget, getCampaignCountdown } from "@/lib/campaign";

const targetAt =
  resolveCampaignTarget(props.attributesMeta, "campaign_end_date") ??
  readDatetimeValue(props.campaign_end_date);
const snap = targetAt ? getCampaignCountdown(targetAt) : null;
if (snap?.expired) return null;
```

**Builder UI:** `DateTimeFieldEditor` (date+time picker).

**Gotchas:**
- Strings tipo `2026-12-01` (sin hora) son aceptados pero ambiguos en TZ. Declara siempre con `T00:00:00Z`.
- Algunos manifiestos antiguos (ej. tech-store `campaign_end_date`) declararon el campo como `type: "text"` con `help_text` indicando ISO. Funciona porque el storefront parsea manualmente, pero pierdes el `schedule` en `attributes_meta` y el editor correcto en el Builder. **Recomendado: migrar a `type: "datetime"`.**
- Atributos `datetime` anidados en `object` / `array` también son normalizados por la recursión.

---

## `link`

Objeto de enlace estructurado (label + url).

**Declaración:**
```json
{
  "name": "cta",
  "label": "CTA",
  "type": "link",
  "localizable": true,
  "config": {
    "allow_external": true,
    "allow_anchor": true
  }
}
```

**Storage — el wrapper localizable envuelve el OBJETO ENTERO:**

```json
{
  "es": { "label": "Ver productos", "url": "/productos" },
  "en": { "label": "See products", "url": "/products" }
}
```

**NO** este shape (no soportado):
```json
{ "label": { "es": "Ver" }, "url": "/p" }
```

No-localizable:
```json
{ "_": { "label": "Ver productos", "url": "/productos" } }
```

**Composición runtime:** unwrap del wrapper → devuelve `{ label, url }`.

**Storefront recibe:** `{ label: string; url: string } | undefined`.

```astro
{cta && <a href={cta.url}>{cta.label}</a>}
```

**Builder UI:** `LinkEditor` (selector interno: páginas, productos, categorías; toggle a URL externa según `allow_external`).

**Gotchas:**
- Si necesitas un solo string URL sin label, usa `type: "text"`. `link` siempre requiere el par.
- `url` interna recomendada con prefijo `/` (ruta relativa); externa con esquema (`https://`).

---

## `object`

JSON estructurado con campos declarados.

**Declaración:**
```json
{
  "name": "promo",
  "label": "Promo",
  "type": "object",
  "localizable": false,
  "config": {
    "schema": {
      "fields": [
        { "name": "badge", "label": "Badge", "type": "text", "localizable": true },
        { "name": "discount_pct", "label": "Descuento %", "type": "number" },
        { "name": "ends_at", "label": "Termina", "type": "datetime" }
      ]
    }
  }
}
```

> La API acepta **dos formas equivalentes** para declarar los hijos (fix de mayo 2026):
> - Canónico: `config.schema.fields` (después de la normalización).
> - Plano: `config.fields` (atajo de manifiesto).
>
> Ambos son leídos por `_field_object_fields` en `use_cases.py:3275`.

**Storage:**
- No-localizable:
  ```json
  {
    "_": {
      "badge": { "es": "Black Week" },
      "discount_pct": { "_": 30 },
      "ends_at": { "_": "2026-12-01T00:00:00Z" }
    }
  }
  ```
- O directamente con keys del objeto (también soportado por `resolve_field_tree_for_composition`: si las keys del valor intersectan con `child_names`, asume objeto inline):
  ```json
  { "badge": { "es": "Black Week" }, "discount_pct": { "_": 30 } }
  ```

**Composición runtime (recursiva):**
1. Unwrap del wrapper del padre según su `localizable`.
2. Para cada hijo: `resolve_field_tree_for_composition` aplica el unwrap del hijo (con `locale_candidates` threaded — sin esto, los hijos localizables salen como `{"es": "..."}`).
3. Si el hijo es a su vez `object` / `array` / `smart_collection_id` / `datetime`, recursa.

**Storefront recibe:** `Record<string, any>` ya con todos los hijos desenvueltos:

```ts
const promo = props.promo;
// promo.badge -> "Black Week" (string)
// promo.discount_pct -> 30 (number)
// promo.ends_at -> "2026-12-01T00:00:00Z" (string ISO)
```

**Builder UI:** depende del `ui` kind. Defaults: schema custom → editor genérico de objeto. UI kinds estructurados disponibles: `logo`, `store_info`, `actions`, `navigation_menu`, `seo`, `cta`, `hero_slide`.

**Gotchas:**
- El walker decide "es objeto inline" si las keys del valor intersectan los nombres declarados (`use_cases.py:3157`). Si tus keys colisionan accidentalmente con nombres de hijos del schema, podés perder el unwrap. Mantén `config.schema.fields` declarado y consistente con la persistencia.
- Si un hijo no aparece en `value`, simplemente no se incluye en el output — el storefront debe usar `?.` para acceder.
- `localizable: true` a nivel de `object` (envuelve todo el objeto por locale) es válido pero raro; prefiere localizar campos hijo.

---

## `array`

Lista ordenada de items estructurados.

**Declaración:**
```json
{
  "name": "items",
  "label": "Beneficios",
  "type": "array",
  "order": 1,
  "is_required": true,
  "config": {
    "item_fields": [
      { "name": "icon", "label": "Icono", "type": "text" },
      { "name": "title", "label": "Título", "type": "text", "localizable": true },
      { "name": "subtitle", "label": "Subtítulo", "type": "text", "localizable": true }
    ]
  }
}
```

> Como `object`, acepta **`config.item_fields`** (plano del manifiesto, usado por tech-store) **y** `config.schema.item_fields` (normalizado). Ambos son leídos por `_field_array_item_fields` (`use_cases.py:3286`).

**Storage:**

```json
{
  "_": [
    { "icon": "truck", "title": { "es": "Envío rápido", "en": "Fast shipping" } },
    { "icon": "shield", "title": { "es": "Garantía oficial" } }
  ]
}
```

Cada item es un dict directo (no envuelto en `"_"`); los hijos localizables de cada item siguen el wrapper habitual.

**Composición runtime (recursiva por item):**
- Walker recorre `value` (lista). Por cada item:
  - Por cada hijo declarado en `item_fields`, llama `resolve_field_tree_for_composition` con `locale_candidates` threaded.
  - Items que no son dict se devuelven sin tocar.
- **Fix crítico de mayo 2026:** la línea ~199 de `composition_attribute_resolution.py` debe incluir `locale_candidates=locale_candidates` en la llamada recursiva. Sin ese argumento, hijos localizables dentro de items salen como `{"es": "..."}` y el storefront renderiza `[object Object]`.

**Storefront recibe:** `Array<Record<string, any>>` con cada item desenvuelto:

```astro
const items = Array.isArray(props.items) ? props.items.filter((i) => i?.title) : [];
{items.map((t) => (
  <div class="ti">
    <Icon n={t.icon ?? "shield"} />
    <div class="tt">{t.title}</div>
    {t.subtitle && <div class="ts">{t.subtitle}</div>}
  </div>
))}
```

**Builder UI:**
- Default: array editor genérico (sortable, add/remove).
- UI kinds: `nav_links` (`LinksArrayEditor`), `hero_banner_item`, `media_gallery`.

**Gotchas:**
- `[object Object]` en producción = falta el threading de `locale_candidates` o el hijo no declaró `localizable: true`. Verifica que tu API esté ≥ mayo 2026.
- Smart collections anidadas: si un item incluye un campo `type: "smart_collection_id"`, el walker lo reemplaza por el envelope completo (con `items`, `collection`, `schedule`). El array final puede ser pesado — considéralo en cache.
- Si `value` no es lista, el walker devuelve `value` sin tocar — el storefront debe validar (`Array.isArray`).
- `is_required` se chequea sobre presencia de la key, no longitud del array. Un `{ "_": [] }` pasa el `required`.

---

## `smart_collection_id`

Referencia a una `SmartCollection`. Es el único tipo que dispara resolución de catálogo en runtime.

**Declaración:**
```json
{
  "name": "products_collection",
  "label": "Productos",
  "type": "smart_collection_id",
  "order": 8,
  "config": {
    "allowed_smart_collection_types": ["product_list"],
    "help_text": "Primer producto = card principal."
  }
}
```

`localizable: false` siempre (la SC tiene sus propias políticas de i18n).

**Storage — tres formas aceptadas:**

| Forma | Cuándo |
|-------|--------|
| `{ "value": 42 }`   | Builder picker (forma canónica nueva) |
| `{ "_": 42 }`       | Legacy compat |
| `"auto:hero-products"` | **Solo durante template authoring**. El templateizer transforma en `{"_smart_collection_placeholder": "hero-products"}` al publicar el template, y el `instantiate` resuelve el placeholder a un id real (ver `12-smart-collections.md`). |

`_coerce_smart_collection_id` (`use_cases.py:3301`) intenta primero `value.value`, después `value._`, después cast directo a `int`.

**Composición runtime:**
1. `_coerce_smart_collection_id` extrae el id.
2. `resolve_smart_collection_envelope` carga la SC y la resuelve (productos, categorías o marcas según `collection_type`).
3. Devuelve un **envelope** completo:
   ```json
   {
     "type": "product_list",
     "items": [ { "id": "...", "name": "...", "price": ..., "image_url": "..." } ],
     "collection": { "id": 42, "name": "Hero products", "config": { ... } },
     "schedule": { "active_from": "...", "active_until": "...", "countdown_target_at": "..." },
     "meta": { "inactive": false, "preview_count": 8 }
   }
   ```
4. Si la SC no existe → `null`. Si está inactiva → envelope con `meta.inactive: true`.

**Detalles del envelope:** ver `proxima-api/docs/cms-website-structure.md` sección "Composición v5".

**Storefront recibe:** el envelope. Helper típico:

```ts
import { collectionItems } from "@/lib/mappers/ui-product";
const products = collectionItems(props.products_collection, catalog);
if (props.products_collection?.meta?.inactive) return null;
```

**Builder UI:** `smart_collection_picker` (`SmartCollectionPickerEditor`). Filtra por `allowed_smart_collection_types`.

**Publish validator:**
- **Saltado** para `is_required` cuando el valor es un placeholder (`{"_smart_collection_placeholder": "..."}`). Esto permite publicar un template con slots data-source sin SCs todavía.
- En el `instantiate`, el auto-scaffold rellena los placeholders con SCs reales del negocio.

**Gotchas:**
- Si el operador deja la sección sin SC, `props.products_collection` será `null` o `undefined`. Tu componente debe degradar (empty state, fallback `bestSellers()`, o `return null`).
- `allowed_smart_collection_types` se valida en deploy y en PATCH: una SC `category_list` no entra en un slot declarado `["product_list"]`.
- El envelope incluye `meta.inactive_reason` para debugging (out of window, manual, etc).
- Ver `12-smart-collections.md` para el lifecycle completo y el algoritmo del auto-scaffold.

---

## Builder-only: `select`

Selector single-value. **NO es un tipo top-level.** Si declaras `"type": "select"` en `attribute_schema[]`, el deploy responde **422** (no está en `ATTRIBUTE_TYPES`).

**Dónde es válido:** solo dentro de `config.item_fields` (de un `array`) o `config.schema.fields` / `config.fields` (de un `object`).

```json
{
  "name": "size",
  "label": "Talla",
  "type": "select",
  "config": {
    "options": [
      { "value": "s", "label": "Small" },
      { "value": "m", "label": "Medium" },
      { "value": "l", "label": "Large" }
    ]
  }
}
```

**Equivalente recomendado en top-level:** usa `type: "text"` con `config.options`. El Builder renderiza el mismo `<select>` por la presencia de `options`, sin necesidad de un `type: "select"` separado.

**Options:**
- Recomendado: `[{ value, label, description? }]`.
- Legado: `string[]` (Builder usa el value como label).
- Alternativa: `option_labels: { value: label }` junto a `options: string[]`.

**Storage:** el `value` de la opción elegida (`"s"`, no `"Small"`).

---

## Builder-only: `product-picker`

Picker de catálogo. **Solo en `item_fields` / `fields`.** Como `select`, devuelve 422 si se usa top-level.

```json
{
  "name": "product_id",
  "label": "Product",
  "type": "product-picker"
}
```

Aparece en el UI kind `hero_banner_item` (`use_cases.py:941`).

**Storage:** id del producto (`{ "_": "prod_123" }` o directo en un item de `array`).

**Storefront recibe:** el id; debes resolverlo contra el catálogo (`catalog.products.get(id)`).

**Diferencia con `smart_collection_id`:** `product-picker` selecciona **un solo producto** estáticamente; `smart_collection_id` resuelve una **colección dinámica** vía reglas (newest, on_sale, by category, etc.).

---

## Apéndice: tabla de referencia rápida

| Type | `supports_localized_values` | `value_shape` | Storage wrapper | Composition output |
|------|---|---|---|---|
| `text` | ✓ | string | `{ "<locale>": str }` o `{ "_": str }` | `string` |
| `rich_text` | ✓ | string | igual a `text` | `string` (HTML) |
| `image` | ✓ | string | `{ "_": str }` o `{ "_": { url, alt, w, h } }` | `string \| MediaRecord` |
| `boolean` | ✗ | boolean | `{ "_": bool }` | `boolean` |
| `number` | ✗ | number | `{ "_": num }` | `number` |
| `datetime` | ✗ | string | `{ "_": "YYYY-MM-DDTHH:MM:SSZ" }` | `string` ISO + `attributes_meta.<n>.schedule` |
| `link` | ✓ | object | `{ "<locale>": { label, url } }` | `{ label, url }` |
| `object` | ✓ | object | nested dict (hijos con sus wrappers) | `Record<string, any>` (recursivo) |
| `array` | ✓ | array | `{ "_": [ { ...item } ] }` | `Array<Record<string, any>>` (recursivo) |
| `smart_collection_id` | ✗ | number | `{ "value": id }` / `{ "_": id }` / `"auto:<key>"` | envelope `{ items, collection, schedule, meta }` |
| `select` *(item_fields)* | — | string | item dict | `string` |
| `product-picker` *(item_fields)* | — | string | item dict | `string` id |

---

## Apéndice: checklist de debugging

1. **El storefront recibe `[object Object]`.**
   - El hijo localizable en `item_fields` no fue desenvuelto. Verifica versión de API (fix mayo 2026 en `composition_attribute_resolution.py:163` y `:199`).
   - El hijo debe declarar `localizable: true` si los datos están en `{"es": "..."}`.

2. **El storefront recibe `undefined` cuando esperaba un valor.**
   - El operador no completó el campo en el Builder.
   - El locale solicitado no existe y el negocio no tiene default → cae al primer disponible. Si la `Section.values` está `{}` para ese atributo, será `undefined`.

3. **`datetime` aparece como string crudo sin countdown.**
   - El manifiesto declaró `type: "text"` en lugar de `type: "datetime"` → no se genera `attributes_meta.<n>.schedule`. Migrar el manifest y redeployar.

4. **Smart collection devuelve `null`.**
   - Id inválido, SC borrada, o `business_id` mismatch en el principal.
   - Revisa `meta.inactive_reason` cuando el envelope sí llega pero está inactivo.

5. **Deploy responde 422 por `type`.**
   - Usaste `select` o `product-picker` como top-level. Mover a `item_fields`/`fields` o cambiar a `text` con `options`.

6. **Publish bloquea por `is_required`.**
   - El valor es `{}`, `null` o falta la key. Para `smart_collection_id`, asegúrate de que sea un placeholder válido (`{"_smart_collection_placeholder": "<key>"}`), no un dict vacío.
