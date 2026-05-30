---
name: add-section
description: >
  Añadir una nueva sección CMS a un storefront existente en este monorepo. Usar cuando
  el usuario quiere: "agregar una sección", "crear un nuevo bloque visual", "nueva sección
  de X para tienda-214", "implementar un hero nuevo", "el cliente quiere un banner de Y".
  También aplica a cualquier otro app en apps/.
---

# Skill: add-section

> **Instalación:** `proxima skills install add-section` · Docs: `proxima-storefront-sdk/docs/04-sections-and-attributes.md`

Una sección vive en **tres lugares** que deben estar sincronizados (en monorepo: `apps/{slug}/`; en proyecto standalone: raíz del app):

```
1. apps/{slug}/proxima.website.json           — contrato de datos (atributos editables)
2. apps/{slug}/src/components/sections/       — componente Astro (renderizado)
3. apps/{slug}/src/components/sections/SectionRenderer.astro  — registro
```

---

## Paso 1 — Identificar el app y la sección

Si no es claro por el contexto, preguntar con **AskUserQuestion**:
- ¿En qué app? (214store, u otro en `apps/`)
- ¿Qué sección? (nombre descriptivo + qué debe mostrar)
- ¿Qué atributos editables necesita el comercio?

Revisar las secciones ya existentes:
```bash
ls apps/{slug}/src/components/sections/
grep -A2 "SECTION_REGISTRY" apps/{slug}/src/components/sections/SectionRenderer.astro
```

---

## Paso 2 — Elegir el key

El key debe ser:
- `snake_case` único dentro del app (e.g. `promo_banner`, `testimonials_grid`)
- Igual en `proxima.website.json`, en `SECTION_REGISTRY` y en el nombre del componente (PascalCase)

Convención de nombres en este repo:
```
key:          promo_banner
Componente:   PromoBannerSection.astro  (o PromoBanner.astro)
REGISTRY key: promo_banner
```

---

## Paso 3 — Crear el componente Astro

Crear en `apps/{slug}/src/components/sections/`:

```astro
---
/**
 * @cms-component PromoBanner
 * @cms-description Banner promocional con imagen, título y CTA.
 */
import EditableAttribute from '@proxima-io/storefront-builder-sdk/EditableAttribute.astro';

export interface PromoBannerProps {
  image?:    { url: string; alt?: string };
  title?:    string;
  subtitle?: string;
  cta?:      { label: string; url: string };
  bg_color?: string;
  // Siempre incluir estos dos para el Builder preview:
  cmsPreview?:     boolean;
  attributesMeta?: Record<string, any>;
}

const props = Astro.props as PromoBannerProps;
const cmsPreview = Boolean(props.cmsPreview);

// Helper para leer metadata del atributo (label, type, etc.) para el Builder
const meta = (name: string) => props.attributesMeta?.[name] ?? {};
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

    {props.cta && (
      <a href={props.cta.url} class="promo-banner__cta">
        {props.cta.label}
      </a>
    )}
  </div>
</section>
```

### Convenciones del componente

- **Props directas** — los valores de los atributos llegan como props individuales (no como un objeto `section.values`)
- **`cmsPreview`** — siempre incluir; habilita los `<EditableAttribute>` en el Builder
- **`attributesMeta`** — siempre incluir; contiene metadata del Builder (label, type, etc.)
- **`EditableAttribute`** — envuelve cada atributo editable para que el Builder pueda seleccionarlo
- Todos los props son **opcionales** — el comercio puede no haber llenado todos los campos

### Builder empty state — secciones de catálogo

Si la sección depende de una **smart collection** (`type: "smart_collection_id"`), implementar un empty state para cuando no hay datos. El patrón es:

```ts
// Frontmatter
// Live mode: no renderizar nada si no hay datos
if (!cmsPreview && collectionItems.length === 0) return null;

// Builder mode: mostrar empty state cuando la colección no está configurada
const showEmptyState = cmsPreview && collectionItems.length === 0;
```

```astro
<!-- Template — dentro del EditableAttribute de la colección -->
<EditableAttribute
  name="my_collection"
  type="smart_collection_id"
  class:list={showEmptyState ? [] : ["grid ..."]}
  ...
>
  {showEmptyState && (
    <div class="flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05]">
        <!-- SVG icon -->
      </div>
      <p class="text-sm font-bold text-white/50">Colección no configurada</p>
      <p class="text-xs text-white/30">Selecciona una smart collection desde el Builder</p>
    </div>
  )}
  {!showEmptyState && items.map(item => (...))}
</EditableAttribute>
```

**Regla:** El empty state **solo** aparece cuando `cmsPreview === true`. En live, la sección retorna `null` sin datos — nunca muestra el placeholder al cliente final. Ver implementaciones de referencia: `ProductGrid.astro`, `HeroBento.astro`, `CategoryGrid.astro`, `BrandsDirectory.astro`.

### Cómo recibe los datos SectionRenderer

`SectionRenderer.astro` pasa cada atributo como prop individual desde `section.values`:

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

---

## Paso 4 — Registrar en SectionRenderer.astro

Abrir `apps/{slug}/src/components/sections/SectionRenderer.astro` y:

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

**c) Añadir el bloque de render:**
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

---

## Paso 5 — Definir el section type en proxima.website.json

Abrir `apps/{slug}/proxima.website.json` y añadir a `section_types`:

```json
{
  "key": "promo_banner",
  "label": "Banner Promocional",
  "category": "content",
  "attribute_schema": [
    { "name": "image",    "label": "Imagen",    "type": "image",  "is_required": true, "order": 1 },
    { "name": "title",    "label": "Título",    "type": "text",   "localizable": true, "order": 2 },
    { "name": "subtitle", "label": "Subtítulo", "type": "text",   "localizable": true, "order": 3 },
    { "name": "cta",      "label": "Botón CTA", "type": "link",                        "order": 4 },
    { "name": "bg_color", "label": "Color fondo","type": "text",                       "order": 5 }
  ]
}
```

### Tipos de atributos disponibles

| type | Para qué | config |
|------|----------|--------|
| `text` | Texto plano corto | — |
| `rich_text` | Texto con formato HTML | — |
| `image` | URL de imagen | — |
| `boolean` | Toggle | — |
| `number` | Número | `{ "min": 1, "max": 10 }` |
| `link` | URL + label | — |
| `object` | Sub-objeto con campos | `{ "fields": [...] }` |
| `array` | Lista de items | `{ "item_fields": [{ "name": "...", "type": "..." }] }` |
| `smart_collection_id` | Query dinámica (productos, categorías) | `{ "allowed_smart_collection_types": ["product_list"] }` |

### `help_text` y `options` (Builder)

**Guía canónica:** `proxima-storefront-sdk/docs/07-cms-attribute-schema.md` (API: `proxima-api/docs/cms-attribute-schema.md`).

- El schema editable lo define el developer en **`proxima.website.json`**; la API **no** hardcodea estructuras por section type.
- **`help_text`**: un string = explicación del **campo**. No uses `"a = foo; b = bar"` para describir opciones.
- **`options`** en `select` o sugerencias en `text`:
  - **Recomendado:** `[{ "value": "flagship", "label": "Tile grande", "description": "…" }]`
  - **Legado:** `["flagship", "standard"]` (label = value)
- Arrays/overrides: `config.schema` con `mode: "array"` e `item_fields` (ver `apps/214store/proxima.website.json` → `hero_bento` → `product_overrides`).

### Flags por atributo

| Flag | Default | Efecto |
|------|---------|--------|
| `is_required: true` | false | Marcado como obligatorio en el Builder |
| `localizable: true` | false | Tiene un valor por idioma |

### Categorías

| category | Para qué |
|----------|----------|
| `navigation` | Header, footer, menús |
| `content` | Banners, texto, testimonials, galería |
| `commerce` | Productos, categorías, búsqueda |

---

## Paso 6 — (Opcional) Añadir al scaffold de una página

Si quieres que la sección aparezca en el scaffold inicial de una página nueva:

```json
{
  "resolver_kind": "content_page",
  "path": "/",
  "label": "Home",
  "scaffold_sections": [
    { "section_type": "hero_bento",   "order": 1 },
    { "section_type": "promo_banner", "order": 2 },  // ← añadida
    { "section_type": "product_grid", "order": 3 }
  ]
}
```

> El scaffold solo aplica cuando la página **aún no tiene secciones del comercio**.
> Si la página home ya tiene secciones del merchant (p. ej. tras seed), el deploy no re-scaffoldea — añadir la sección manualmente en Builder o vaciar la página antes del deploy.

---

## Paso 7 — Deploy

```bash
cd apps/{slug}
proxima deploy {slug}
```

Output esperado:
```
Section types
  + created  promo_banner
  · unchanged  hero_bento, product_grid, ...
```

Después del deploy, la sección aparece disponible en el Builder.

---

## Verificar

1. El comercio abre el Builder → la sección `promo_banner` aparece en la lista de secciones disponibles
2. Añadir la sección a una página de prueba → aparece el formulario con los atributos definidos
3. Guardar y ver la página → `SectionRenderer.astro` renderiza el componente con los valores

---

## Ejemplos de secciones en este repo

Ver `apps/214store/src/components/sections/` para referencias:

| Componente | Key | Descripción |
|------------|-----|-------------|
| `HeroBento.astro` | `hero_bento` | Hero con bento grid de productos |
| `ProductGrid.astro` | `product_grid` | Grilla de productos con smart collection |
| `ProductListingPage.astro` | `product_listing` | PLP con filtros (marca, precio, stock), sorting y paginación — para /productos ⚠️ patrón especial: lee filtros activos de `Astro.url.searchParams`, no solo de `section.values` |
| `CategoryGrid.astro` | `category_grid` | Grilla de categorías |
| `CategoryShowcase.astro` | `category_showcase` | Showcase visual de categorías |
| `PromoMarquee.astro` | `promo_marquee` | Ticker de texto promocional |
| `GamingStrip.astro` | `gaming_strip` | Strip de gaming con items |
| `BrandTrust.astro` | `brand_trust` | Sección de marcas con logos |

---

## Secciones shell — header, footer, mega_menu

Las secciones shell son **globales** (`shell_sections` en el manifiesto). Se renderizan en **`SiteLayout.astro`**, no en `SectionRenderer`.

| Shell section | Componente | Qué hace |
|---------------|------------|----------|
| `mega_menu` | `MegaMenu.astro` | Árbol de categorías (API) + `category_overrides` CMS |
| `header` | `Header.astro` | Logo, búsqueda, nav, carrito |
| `footer` | `Footer.astro` | Columnas, links, newsletter |

**Sí son editables en Builder** — logo, nav items, labels del mega menú, overrides de categoría, etc. Lo que viene del catálogo (nombres/slugs reales de categorías) se fusiona en SSR; el merchant no edita el catálogo desde el shell.

El `attribute_schema` de shell types vive en `proxima.website.json` (`category: "shell"`). Valores iniciales: `shell_default_values`.

### category_overrides en mega_menu

El `mega_menu` permite que el comercio personalice la presentación de cada categoría **sin tocar el catálogo**. Los overrides son una capa de presentación CMS que se fusiona con los nodos del árbol en el frontmatter del componente.

**Atributos del schema (ya declarados en `proxima.website.json`):**

| Atributo | Tipo | Para qué |
|----------|------|----------|
| `all_products_label` | text, localizable | Label del link "Ver todos" |
| `all_products_url` | text | URL del link "Ver todos" (default `/productos`) |
| `category_overrides` | array | Lista de overrides por slug de categoría |

**Campos de cada item en `category_overrides`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `category_slug` | text, required | Slug de la categoría que se quiere personalizar |
| `badge` | text (options) | Badge visual: `OFERTA`, `NUEVO`, `POPULAR`, `DESTACADO`, `LIQUIDACIÓN` |
| `highlight` | boolean | Si mostrar la categoría visualmente destacada |
| `label_override` | text | Reemplaza el nombre del catálogo solo en el nav |
| `hidden` | boolean | Oculta la categoría del nav sin borrarla del catálogo |

**Patrón de implementación en el componente Astro:**

```ts
// Interfaces en el frontmatter de MegaMenu.astro
interface CategoryOverride {
  category_slug: string;
  badge?: string;
  highlight?: boolean;
  label_override?: string;
  hidden?: boolean;
}

interface RichCatNode extends CategoryNavNode {
  _label: string;
  _highlighted: boolean;
  _badge: string | null;
}

// Props del componente
interface Props {
  navTree?: CategoryNavNode[];       // árbol desde fetchCategoryNavTree()
  category_overrides?: CategoryOverride[];  // valores desde section.values
  all_products_label?: string;
  all_products_url?: string;
  // ... otros props, cmsPreview, attributesMeta
}

// Pre-computar en frontmatter (OBLIGATORIO — ver restricción Astro)
const rawOverrides = Array.isArray(Astro.props.category_overrides)
  ? (Astro.props.category_overrides as CategoryOverride[])
  : [];
const overridesMap = new Map(rawOverrides.map((o) => [o.category_slug, o]));

const visibleTree: RichCatNode[] = (Astro.props.navTree ?? [])
  .filter((cat) => !overridesMap.get(cat.slug)?.hidden)
  .map((cat) => {
    const ov = overridesMap.get(cat.slug);
    return {
      ...cat,
      _label: ov?.label_override?.trim() || cat.name,
      _highlighted: ov?.highlight === true,
      _badge: ov?.badge?.trim() || null,
    };
  });
```

**En el template** — usar `visibleTree` en lugar de `navTree`:

```astro
{visibleTree.map((cat) => (
  <li class:list={['nav-item', cat._highlighted && 'nav-item--highlighted']}>
    <a href={cat.href}>{cat._label}</a>
    {cat._badge && <span class="cat-badge">{cat._badge}</span>}
  </li>
))}
```

> **Restricción Astro crítica:** En templates, `.map()` con cuerpo de bloque (`{ const x; return ... }`)
> causa parse errors silenciosos. Los cálculos que requieren `const` / lógica deben estar en el
> frontmatter (como `visibleTree`). En el template solo usar arrow-expression puras.

### SiteLayout — datos del árbol para mega_menu

`MegaMenu.astro` recibe el árbol desde `SiteLayout.astro`, que lo obtiene en SSR:

```ts
// SiteLayout.astro (frontmatter)
import { fetchCategoryNavTree } from '@proxima-io/storefront-core';

const navTreeResult = await fetchCategoryNavTree({ locale: activeLocale });
const navTree = navTreeResult?.nodes ?? [];
```

Los `category_overrides` se leen del shell section via `section.values.category_overrides`.

---

## Modificar una sección existente

### Añadir atributo opcional (siempre seguro)

1. Añadir prop al componente Astro
2. Añadir la prop en el bloque de `SectionRenderer.astro`
3. Añadir el atributo en `proxima.website.json` sin `is_required: true`
4. Deploy

### Cambiar label o order (siempre seguro)

Solo cambiar en `proxima.website.json` y deployar.

### Cambiar el `type` de un atributo (breaking)

```bash
proxima deploy {slug} --force
```

El contenido del comercio guardado con el tipo anterior puede quedar inválido.

### Renombrar el `name` de un atributo (breaking)

La API lo trata como delete + create. El contenido se pierde.

```bash
proxima deploy {slug} --force
```

También actualizar el nombre de la prop en el componente Astro y en `SectionRenderer.astro`.
