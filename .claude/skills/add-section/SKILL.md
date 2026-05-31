---
name: add-section
description: >
  Añadir una nueva sección a un storefront existente. Usar cuando el usuario quiere:
  "agregar una sección", "crear un nuevo bloque", "añadir un banner", "nueva sección
  de testimonials", "el cliente quiere una sección de X", "implementar un nuevo
  section type".
---

# Skill: Añadir una sección nueva

Una "sección" en Proxima vive en tres lugares simultáneamente. Los tres deben estar
sincronizados:

```
1. proxima.website.json                            — contrato de datos (atributos editables)
2. src/components/sections/                        — componente Astro (renderizado)
3. src/components/sections/SectionRenderer.astro   — SECTION_REGISTRY + bloque de render
```

Si alguno de los tres falta, la sección no funciona correctamente.

---

## Paso 1 — Recopilar información

Pregunta al usuario con **AskUserQuestion** si no es obvio por el contexto:

1. **¿Qué sección quiere añadir?** (nombre descriptivo, e.g. "Testimonials", "Banner promocional")
2. **¿Qué atributos necesita?** (campos editables — texto, imagen, etc.)
3. **¿En qué páginas irá?** (¿se añade al scaffold de alguna página existente o solo será disponible para el Builder?)

---

## Paso 2 — Definir el section type en el manifiesto

Abrir `proxima.website.json` y añadir el nuevo section type a la lista `section_types`.

### Elegir el key

El key debe ser:
- Único dentro del manifiesto
- `snake_case` (minúsculas + guiones bajos)
- Descriptivo y corto: `testimonials`, `promo_banner`, `featured_products`

### Template de section type

```json
{
  "key": "<key>",
  "label": "<Nombre visible en el Builder>",
  "category": "<content|navigation|commerce>",
  "attribute_schema": []
}
```

**Categorías disponibles:**

| category | Cuándo usarla |
|----------|---------------|
| `navigation` | Header, footer, menús |
| `content` | Hero, banners, texto, testimonials, galería |
| `commerce` | Productos, categorías, búsqueda, carrito |

### Definir los atributos

Por cada campo editable en la sección, añadir un entry en `attribute_schema`:

```json
{
  "name": "<nombre_interno>",
  "label": "<Etiqueta en el Builder>",
  "type": "<tipo>",
  "order": <número>,
  "is_required": true,
  "localizable": true,
  "config": {}
}
```

Solo `name`, `label`, `type` y `order` son obligatorios. El resto es opcional.

### Tipos de atributos

| type | Para qué | config |
|------|----------|--------|
| `text` | Texto plano corto | — |
| `rich_text` | Texto con formato (HTML) | — |
| `image` | URL de imagen | — |
| `boolean` | Toggle / checkbox | — |
| `number` | Número | `{ "min": 1, "max": 10 }` |
| `link` | URL + label | — |
| `datetime` | Fecha/hora de campaña (countdown target) | — siempre `localizable: false` |
| `object` | Sub-objeto con campos propios | `{ "fields": [...] }` |
| `array` | Lista de items repetibles | `{ "item_fields": [{ "name": "...", "type": "..." }] }` |
| `smart_collection_id` | Query dinámica (productos, categorías...) | `{ "allowed_smart_collection_types": ["product_list"] }` |

> **Tipos Builder-only (no válidos en deploy):** `select` y `product-picker` solo pueden usarse dentro de `config.schema.item_fields` (campos anidados en `object`/`array`). Usarlos como tipo raíz en `attribute_schema` causa `422`.

### `help_text` y `options` (Builder)

**Guía canónica:** [`docs/07-cms-attribute-schema.md`](../../docs/07-cms-attribute-schema.md) (API: `proxima-api/docs/cms-attribute-schema.md`).

- Schema en **`proxima.website.json`** → `website-deploy` → `WebsiteSectionType`; la API no hardcodea por section type.
- **`help_text`**: explicación del campo (un string). No `"optA = …; optB = …"`.
- **`options`**: `[{ "value", "label", "description"? }]` (recomendado) o `string[]` (legado).
- Overrides en arrays: `config.schema` + `item_fields`. Referencia: `proxima-storefronts/apps/214store/proxima.website.json`.

### Flags por atributo

| Flag | Tipo | Default | Efecto |
|------|------|---------|--------|
| `is_required` | boolean | `false` | El Builder marca el campo como obligatorio |
| `localizable` | boolean | `false` | El campo tiene un valor por idioma |

> ⚠ Añadir `is_required: true` a una sección ya deployada genera un **warning** en el
> siguiente deploy: las secciones existentes del comercio no tienen valor para ese campo.
> Considera si necesitas una migración de contenido.

### Ejemplos de section types completos

**Banner simple:**
```json
{
  "key": "promo_banner",
  "label": "Banner Promocional",
  "category": "content",
  "attribute_schema": [
    { "name": "image",      "label": "Imagen",     "type": "image",   "is_required": true, "order": 1 },
    { "name": "title",      "label": "Título",      "type": "text",    "localizable": true,  "order": 2 },
    { "name": "subtitle",   "label": "Subtítulo",   "type": "text",    "localizable": true,  "order": 3 },
    { "name": "cta",        "label": "Botón",       "type": "link",                          "order": 4 },
    { "name": "bg_color",   "label": "Color fondo", "type": "text",                          "order": 5 }
  ]
}
```

**Testimonials:**
```json
{
  "key": "testimonials",
  "label": "Testimonios",
  "category": "content",
  "attribute_schema": [
    { "name": "headline", "label": "Título", "type": "text", "localizable": true, "order": 1 },
    {
      "name": "items",
      "label": "Testimonios",
      "type": "array",
      "order": 2,
      "config": {
        "item_fields": [
          { "name": "author",  "type": "text",  "label": "Nombre" },
          { "name": "quote",   "type": "text",  "label": "Cita" },
          { "name": "avatar",  "type": "image", "label": "Foto" },
          { "name": "rating",  "type": "number","label": "Rating" }
        ]
      }
    }
  ]
}
```

**Grilla de productos featured:**
```json
{
  "key": "featured_products",
  "label": "Productos Destacados",
  "category": "commerce",
  "attribute_schema": [
    { "name": "headline",  "label": "Título",     "type": "text",               "localizable": true, "order": 1 },
    { "name": "products",  "label": "Productos",  "type": "smart_collection_id", "order": 2,
      "config": { "allowed_smart_collection_types": ["product_list", "manual"] }
    },
    { "name": "columns",   "label": "Columnas",   "type": "number",              "order": 3,
      "config": { "min": 2, "max": 6 }
    }
  ]
}
```

---

## Paso 3 — Añadir a scaffold_sections (opcional)

Si la nueva sección debe aparecer en el scaffold de alguna página, añadirla a `pages[].scaffold_sections`:

```json
{
  "resolver_kind": "content_page",
  "path": "/",
  "label": "Home",
  "scaffold_sections": [
    { "section_type": "header",       "order": 1  },
    { "section_type": "hero",         "order": 2  },
    { "section_type": "promo_banner", "order": 3  },   // ← añadida
    { "section_type": "footer",       "order": 99 }
  ]
}
```

> El scaffold solo aplica a **páginas que aún no tienen secciones del comercio**.
> Si la página ya existe con secciones, este cambio no tendrá efecto en el siguiente deploy.

---

## Paso 4 — Crear el componente Astro

Crear el archivo en `src/components/sections/` (o `src/sections/` según la convención del storefront):

```astro
<!-- src/components/sections/PromoBanner.astro -->
---
import EditableAttribute from '@proxima-io/storefront-builder-sdk/EditableAttribute.astro';

export interface PromoBannerProps {
  image?:    { url: string; alt?: string };
  title?:    string;
  subtitle?: string;
  cta?:      { label: string; url: string };
  bg_color?: string;
  // Siempre incluir para el Builder:
  cmsPreview?:     boolean;
  attributesMeta?: Record<string, any>;
}

const props = Astro.props as PromoBannerProps;
const cmsPreview = Boolean(props.cmsPreview);
---

<section class="promo-banner" style={props.bg_color ? `background-color:${props.bg_color}` : ''}>
  {props.image && (
    <EditableAttribute enabled={cmsPreview} attributeKey="image" label="Imagen" type="image">
      <img src={props.image.url} alt={props.image.alt ?? props.title ?? ''} />
    </EditableAttribute>
  )}
  <div class="promo-banner__content">
    {props.title && (
      <EditableAttribute enabled={cmsPreview} attributeKey="title" label="Título" type="text">
        <h2>{props.title}</h2>
      </EditableAttribute>
    )}
    {props.subtitle && <p>{props.subtitle}</p>}
    {props.cta && <a href={props.cta.url} class="promo-banner__cta">{props.cta.label}</a>}
  </div>
</section>
```

**Convenciones del componente:**

- Props **individuales** por atributo (no `section.values` como objeto)
- `cmsPreview` y `attributesMeta` — siempre presentes; los pasa `SectionRenderer.astro`
- `EditableAttribute` — envuelve campos editables para que el Builder pueda seleccionarlos
- Todos los props son opcionales — el comercio puede no haberlos llenado
- Para `smart_collection_id`: la API ya resolvió la colección como envelope con `items`, `meta`, `schedule`

---

## Paso 5 — Registrar en SectionRenderer.astro

Abrir `src/components/sections/SectionRenderer.astro` y:

**a) Añadir el import:**
```astro
---
import PromoBanner from "./PromoBanner.astro";
// ... resto de imports
---
```

**b) Añadir al SECTION_REGISTRY:**
```ts
const SECTION_REGISTRY = {
  hero_bento:   HeroBento,
  product_grid: ProductGrid,
  promo_banner: PromoBanner,    // ← nueva
  // ...
} satisfies Record<string, any>;
```

**c) Añadir el bloque de render** (dentro del template de `SectionRenderer.astro`):
```astro
{section.type === "promo_banner" && (
  <PromoBanner
    image={section.values.image}
    title={section.values.title}
    subtitle={section.values.subtitle}
    cta={section.values.cta}
    bg_color={section.values.bg_color}
    cmsPreview={cmsPreview}
    attributesMeta={section.attributesMeta}
  />
)}
```

**El key en `SECTION_REGISTRY` debe ser idéntico al `key` en `proxima.website.json`.**

---

## Paso 6 — Deploy

```bash
# Verificar el payload sin llamar la API
proxima deploy --dry-run

# Deploy
proxima deploy
```

Output esperado si es la primera vez que se deploya esta sección:
```
Section types
  + created  promo_banner
  · unchanged  hero, header, footer, ...
```

---

## Verificar que funciona

1. Abrir el Builder de Proxima → el nuevo section type debe aparecer disponible
2. Añadir la sección a una página de prueba
3. Configurar los atributos desde el Builder
4. Verificar el renderizado en el storefront

---

## Modificar una sección existente

### Añadir atributo (seguro)

Simplemente agregar el nuevo atributo en `attribute_schema` con `is_required: false` o sin el campo.
El siguiente deploy lo aplica sin preguntar.

```json
{ "name": "nuevo_campo", "label": "Nuevo campo", "type": "text", "order": 5 }
```

### Añadir atributo obligatorio (genera warning)

```json
{ "name": "campo_requerido", "label": "Campo requerido", "type": "text", "is_required": true, "order": 5 }
```

El deploy procede pero avisa que N secciones existentes no tienen valor.

### Cambiar el label o order (seguro)

Sin restricciones. El siguiente deploy lo actualiza.

### Cambiar el type de un atributo (breaking — requiere --force)

```bash
templateizer website-deploy --force
```

> Usar con cuidado: el contenido del comercio guardado con el tipo anterior
> puede quedar inválido o inaccesible.

### Renombrar el name de un atributo (breaking — requiere --force)

Desde la perspectiva de la API, renombrar = eliminar el atributo viejo + crear uno nuevo.
El contenido guardado bajo el nombre viejo queda huérfano.

```bash
templateizer website-deploy --force
```

---

## Eliminar una sección

La API no elimina section types automáticamente cuando desaparecen del manifiesto.
Esto es intencional: el contenido del comercio no se borra sin una acción explícita.

Para "eliminar" una sección del workflow del developer:
1. Quitar el key de `proxima.website.json`
2. Quitar el componente de `SECTION_MAP`
3. El comercio seguirá viendo las secciones existentes en el Builder hasta que las elimine manualmente

Si se quiere ocultar el type del Builder sin borrar las instancias existentes,
contactar al equipo de Proxima para marcar el section type como `is_active: false` en la BD.
