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
| `type` | `text`, `rich_text`, `image`, `boolean`, `number`, `link`, `object`, `array`, `smart_collection_id` |
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

## Checklist para nuevos section types

- [ ] Cada campo editable tiene `label` y, si ayuda, `help_text` **del campo**
- [ ] Selects usan `options` estructuradas, no prose en `help_text`
- [ ] Overrides en `config.schema.item_fields` con `mode: "array"`
- [ ] Keys del manifiesto = keys en `SECTION_REGISTRY` del storefront
- [ ] `website-deploy` después de cambiar el schema
