---
name: wire-cms-sections
description: >
  Conectar secciones Astro ya existentes al CMS de Proxima. Usar cuando el storefront
  ya tiene componentes visuales (de un diseño HTML/ZIP convertido, o construidos a mano)
  pero aún no son editables desde el Builder. Cubre: sincronizar attribute_schema en
  proxima.website.json con los props reales del componente, agregar EditableAttribute
  wrappers para inline editing, y deployar el manifiesto. Ejemplos: "conecta nocturna al
  CMS", "haz que las secciones sean editables", "wire up the CMS", "el Builder no muestra
  los campos correctos", "hay un mismatch entre el schema y los props".
---

# Skill: wire-cms-sections

> **Instalación:** `proxima skills install wire-cms-sections` · Docs: `07-cms-attribute-schema.md`, `04-sections-and-attributes.md`

Convierte secciones Astro **ya construidas** en secciones **CMS-editables**.

Rutas en monorepo: `apps/{slug}/`. En proyecto standalone Astro, sustituir por la raíz del storefront.

El caso típico: el diseñador entregó un ZIP o HTML que fue convertido a componentes Astro.
Los componentes renderizan bien en fixtures, pero el Builder no puede editarlos porque:
- El `attribute_schema` en `proxima.website.json` tiene nombres de campo incorrectos o incompletos
- Los componentes no tienen `EditableAttribute` wrappers (inline editing deshabilitado)
- Los tipos de atributo no reflejan los tipos de dato reales

---

## Contexto — dónde vive cada pieza

```
proxima.website.json          ← CONTRATO del Builder (qué campos existen y de qué tipo)
  section_types[].attribute_schema[]
    .name       ← debe coincidir EXACTAMENTE con el prop del componente
    .type       ← text / rich_text / image / number / boolean / array / link / smart_collection_id
    .label      ← label legible para el comercio en el Builder UI
    .localizable ← true si tiene valor por idioma
    .config.help_text ← instrucción breve para el comercio

SectionRenderer.astro         ← pasa section.values.{name} → componente como prop
  {section.type === "mi_hero" && (
    <MiHero heading={section.values.heading} ... />
  )}

MiHero.astro                  ← recibe los props, los renderiza con EditableAttribute
  <EditableAttribute meta={attributeKey("heading")} ...>
    <h1>{heading}</h1>
  </EditableAttribute>
```

**Regla de oro:** el `name` en `attribute_schema` debe ser idéntico al nombre del prop
en el componente Y al nombre de la key en `section.values.*` en SectionRenderer.

---

## Paso 1 — Identificar el app y las secciones a wirear

Si no es claro por contexto, preguntar con **AskUserQuestion**:
- ¿En qué app? (`apps/nocturna`, `apps/214store`, etc.)
- ¿Qué secciones? (todas las del SECTION_REGISTRY, o solo algunas específicas)

Listar las secciones registradas:
```bash
grep -E "^\s+\w+:" apps/{slug}/src/components/sections/SectionRenderer.astro | head -40
```

Para cada sección a wirear, identificar su componente:
```bash
ls apps/{slug}/src/components/sections/
```

---

## Paso 2 — Auditar el mismatch (CRÍTICO — hacer antes de editar)

Para cada sección, comparar los props reales del componente contra el `attribute_schema` actual.

### Extraer props reales del componente

Leer el componente y extraer el `interface Props { ... }`:

```bash
grep -A 30 "interface Props" apps/{slug}/src/components/sections/MiSeccion.astro
```

Los props relevantes son los que llegan directamente desde `section.values.*` —
NO incluir `cmsPreview` ni `attributesMeta` en el `attribute_schema`.

### Extraer el schema actual del manifiesto

```bash
python3 -c "
import json, sys
data = json.load(open('apps/{slug}/proxima.website.json'))
for st in data['section_types']:
    if st['key'] == 'mi_seccion':
        for a in st.get('attribute_schema', []):
            print(a['name'], '->', a['type'])
"
```

### Tabla de mismatch

Para cada campo, crear una tabla:

| Prop en componente | name en schema | ¿Coincide? | Acción |
|--------------------|----------------|------------|--------|
| `heading_line1` | `heading` | ❌ | Renombrar en schema |
| `heading_accent` | — | ❌ falta | Agregar en schema |
| `body` | `body` | ✅ | — |
| `features` | `zones` | ❌ | Reemplazar (array) |

**Regla:** siempre adaptar el schema para que coincida con los props del componente —
NO cambiar los props del componente para que coincidan con un schema incorrecto
(los componentes ya funcionan en fixtures y tienen el diseño correcto).

---

## Paso 3 — Corregir el `attribute_schema` en `proxima.website.json`

Para cada sección con mismatches, actualizar la entrada en `section_types`:

### Inferencia de tipos

| Si el prop es... | `type` en schema |
|------------------|-----------------|
| `string` corto (heading, label, phone) | `"text"` |
| `string` largo (body, description) | `"text"` con `config.multiline: true` |
| `number` (price, threshold) | `"number"` |
| `boolean` | `"boolean"` |
| `string \| null` que es una URL de imagen | `"image"` |
| `{ label: string; url: string }` | `"link"` |
| `Array<{ ... }>` | `"array"` con `config.schema.item_fields` |
| smart collection (productos, categorías) | `"smart_collection_id"` |

### Flags útiles

| Flag | Cuándo usarlo |
|------|---------------|
| `"localizable": true` | Texto visible al cliente (headings, body, CTAs) |
| `"is_required": true` | Campo sin el cual la sección se ve rota |
| `"config.help_text"` | Siempre en campos no obvios (ej. formato de teléfono, separadores) |

### Campos que NO van al schema

- `cmsPreview` — prop interno del Builder, nunca en el schema
- `attributesMeta` — prop interno del Builder, nunca en el schema
- `currency` / `locale` — vienen de `website.*`, no de `section.values`
- Props que se pasan desde `website.*` (no desde `section.values`)

Para saber qué recibe cada componente desde `website.*` vs `section.values`,
leer el bloque correspondiente en `SectionRenderer.astro`:

```astro
{section.type === "featured_spirits" && (
  <FeaturedSpirits
    heading={section.values.heading}         ← viene de section.values → va al schema
    currency={website.currency}              ← viene de website → NO va al schema
    cmsPreview={cmsPreview}                  ← interno → NO va al schema
  />
)}
```

### Ejemplo: sección con array de items

```json
{
  "name": "features",
  "label": "Características del servicio",
  "type": "array",
  "order": 5,
  "config": {
    "schema": {
      "mode": "array",
      "item_label": "Característica",
      "item_type": "object",
      "item_fields": [
        { "name": "icon",        "label": "Ícono",       "type": "text",
          "help_text": "Nombre del ícono (bolt, shield, clock, check)" },
        { "name": "title",       "label": "Título",      "type": "text" },
        { "name": "description", "label": "Descripción", "type": "text" }
      ]
    }
  }
}
```

---

## Paso 4 — Agregar `EditableAttribute` en los componentes

El `EditableAttribute` permite al comercio hacer clic en cualquier campo del
preview en vivo y editarlo directamente (inline editing).

### Setup en el frontmatter

```astro
---
import EditableAttribute from "@proxima-io/storefront-builder-sdk/EditableAttribute.astro";
import { getSectionAttr } from "@proxima-io/storefront-builder-sdk";

interface Props {
  heading?: string;
  body?: string;
  cmsPreview?: boolean;
  attributesMeta?: Record<string, unknown>;
}

const { heading, body, cmsPreview = false, attributesMeta } = Astro.props;

// Helper para inline editing — retorna { attributeKey, attributeLabel, attributeType }
const { key: attributeKey } = getSectionAttr(attributesMeta);
---
```

### Uso en el template

```astro
<EditableAttribute meta={attributeKey("heading")}>
  <h2 class="noct-display" style="font-size:72px;">{heading}</h2>
</EditableAttribute>

<EditableAttribute meta={attributeKey("body")}>
  <p class="noct-sans">{body}</p>
</EditableAttribute>
```

### Campos que SÍ necesitan `EditableAttribute`

- Headings, títulos, subtítulos
- Cuerpos de texto, descripciones
- CTAs (label + URL)
- Imágenes (foto del producto, hero image)
- Precios, números destacados

### Campos que NO necesitan `EditableAttribute`

- Arrays completos (el Builder tiene su propio editor de arrays)
- Smart collections (el Builder tiene su picker)
- Props que vienen de `website.*` (currency, locale)
- Props internos (cmsPreview, attributesMeta)

### Regla de granularidad

Wrappear **el elemento visible más pequeño** — no el contenedor entero.

```astro
<!-- ✅ Correcto — wrappea el h2 individual -->
<div class="grid">
  <EditableAttribute meta={attributeKey("heading")}>
    <h2>{heading}</h2>
  </EditableAttribute>
  <EditableAttribute meta={attributeKey("body")}>
    <p>{body}</p>
  </EditableAttribute>
</div>

<!-- ❌ Incorrecto — wrappea el contenedor entero (no permite seleccionar campos individuales) -->
<EditableAttribute meta={attributeKey("content")}>
  <div class="grid">
    <h2>{heading}</h2>
    <p>{body}</p>
  </div>
</EditableAttribute>
```

---

## Paso 5 — Verificar SectionRenderer

Asegurarse de que cada prop del componente que está en el `attribute_schema`
está siendo pasado desde `SectionRenderer.astro`:

```astro
{section.type === "noct_hero" && (
  <NocturnaHero
    pill_text={section.values.pill_text}       ← ✅ coincide con schema name: "pill_text"
    heading_line1={section.values.heading_line1} ← ✅ coincide
    heading_accent={section.values.heading_accent} ← ✅ coincide
    body={section.values.body}
    cta_label={section.values.cta_label}
    cta_phone={section.values.cta_phone}
    currency={website.currency}                ← ✅ desde website, no desde section.values
    cmsPreview={cmsPreview}
    attributesMeta={section.attributesMeta}
  />
)}
```

Si falta algún prop, añadirlo tanto en el bloque de SectionRenderer como en
el `attribute_schema` del manifiesto.

---

## Paso 6 — Dry-run y deploy

Desde la raíz del monorepo:

```bash
# Verificar sin subir
proxima deploy {slug} --dry-run

# Subir si todo está bien
proxima deploy {slug}
```

### Si hay breaking changes (409)

Ocurre cuando se renombró un `name` o se cambió un `type` que ya estaba en la API.
En un storefront nuevo (sin contenido del comercio), forzar es siempre seguro:

```bash
proxima deploy {slug} --force
```

### Output esperado

```
Section types
  ~ updated  noct_hero           (8 attributes changed)
  ~ updated  spirits_categories  (3 attributes changed)
  ~ updated  featured_spirits    (2 attributes changed)
  ~ updated  editor_pick         (5 attributes changed)
  ~ updated  delivery_section    (4 attributes changed)
  ~ updated  testimonios_section (2 attributes changed)
  ~ updated  whatsapp_cta        (3 attributes changed)

Pages
  · skipped  /  (has merchant sections)
```

---

## Paso 7 — Verificar en el Builder

Con el CMS preview activo (`?preview=true` o desde el Builder):

1. Abrir la página en el Builder → las secciones deben aparecer con los campos correctos
2. Hacer clic en un heading → debe aparecer el inline editor del campo
3. Cambiar un valor → la sección debe re-renderizar con el nuevo valor en tiempo real
4. Guardar → el valor debe persistir en la API

---

## Checklist completo

Para cada sección:

- [ ] Props del componente extraídos y documentados
- [ ] Tabla de mismatch creada (prop vs schema name)
- [ ] `attribute_schema` en `proxima.website.json` corregido:
  - [ ] Nombres coinciden exactamente con props del componente
  - [ ] Tipos inferidos correctamente (text/number/image/array/etc.)
  - [ ] `localizable: true` en campos visibles al cliente
  - [ ] `help_text` en campos no obvios
  - [ ] `cmsPreview` y `attributesMeta` NO están en el schema
- [ ] `EditableAttribute` agregado en el componente para los campos clave
- [ ] `getSectionAttr` y `attributesMeta` en el frontmatter
- [ ] SectionRenderer pasa todos los `section.values.*` correctamente
- [ ] `proxima deploy {slug} --dry-run` sin errores
- [ ] `proxima deploy {slug}` exitoso

---

## Errores comunes

### "El Builder muestra un campo pero el componente no lo usa"
→ El `name` en el schema no coincide con el prop del componente.
→ Verificar en SectionRenderer qué prop recibe el componente.

### "El campo se edita en el Builder pero no cambia en la vista"
→ El prop no está siendo pasado en SectionRenderer (`section.values.nombre`).
→ O el componente usa un default value que sobreescribe el valor CMS.

### "El inline editing no funciona (no aparece el cursor al hacer clic)"
→ Falta el wrapper `<EditableAttribute>` en el componente.
→ O `cmsPreview` es `false` en el contexto actual.

### "409 Breaking changes"
→ Se renombró un `name` o cambió un `type` que ya existía en la API.
→ En storefronts nuevos sin contenido del comercio, usar `--force`.

---

## Referencia — secciones ya wireadas correctamente

Ver `apps/214store/src/components/sections/` para ejemplos de referencia:

| Componente | Patrón destacado |
|------------|-----------------|
| `HeroBento.astro` | EditableAttribute en heading, smart collection picker |
| `ProductGrid.astro` | Array de productos, empty state Builder |
| `PromoMarquee.astro` | Campo text con options (variantes de color) |
| `CategoryGrid.astro` | Smart collection + override por item |
| `BrandsDirectory.astro` | Array de items con imagen + texto |

Ver también `apps/214store/proxima.website.json` para ejemplos de `attribute_schema`
con `help_text`, `options`, arrays anidados y smart collections.
