# 04 — Sections y Attributes

Cómo definir, registrar y renderizar secciones. El ciclo completo desde diseño hasta código.

---

## El ciclo de vida de una sección

```
1. Diseño → Identificar qué partes son editables
2. Schema  → Definir attribute_schema (nombre, tipo, label)
3. Registro → Crear el SectionType en el admin (o via template)
4. Componente → Crear el Astro component que renderiza
5. Router → Añadir al SECTION_MAP
6. Builder → Envolver con EditableSection/EditableAttribute
```

---

## Paso 1 — Analizar el diseño

Dado este bloque de HTML:

```html
<section class="hero">
  <img src="banner.jpg" alt="Banner" />
  <h1>Bienvenido a nuestra tienda</h1>
  <p>Los mejores productos al mejor precio</p>
  <a href="/productos" class="cta">Ver catálogo</a>
</section>
```

Preguntarse: ¿qué debe poder cambiar el comercio desde el builder?

```
imagen    → editable → type: image
título    → editable → type: text
subtítulo → editable → type: text
botón     → editable → type: link  (texto + URL juntos)
```

---

## Paso 2 — Definir el schema

En el `proxima.template.json` o directamente en el admin:

```json
{
  "key": "hero",
  "label": "Hero Principal",
  "category": "content",
  "attribute_schema": [
    {
      "name": "image",
      "label": "Imagen de fondo",
      "type": "image",
      "is_required": true,
      "order": 1
    },
    {
      "name": "headline",
      "label": "Título",
      "type": "text",
      "is_required": true,
      "localizable": true,
      "order": 2
    },
    {
      "name": "subheadline",
      "label": "Subtítulo",
      "type": "text",
      "localizable": true,
      "order": 3
    },
    {
      "name": "cta",
      "label": "Botón CTA",
      "type": "link",
      "order": 4
    }
  ]
}
```

---

## Paso 3 — Crear el componente Astro

```astro
---
// src/sections/HeroSection.astro
import { EditableSection, EditableAttribute } from '@proxima-io/storefront-builder-sdk';
import type { CmsSection } from '@proxima-io/storefront-cms';

interface Props {
  section: CmsSection;
}

const { section } = Astro.props;
const { image, headline, subheadline, cta } = section.attributes;
---

<EditableSection {section}>
  <section class="hero" style={image ? `background-image: url(${image})` : ''}>
    <div class="hero__content">
      <EditableAttribute {section} attributeKey="headline">
        <h1 class="hero__title">{headline}</h1>
      </EditableAttribute>

      {subheadline && (
        <EditableAttribute {section} attributeKey="subheadline">
          <p class="hero__subtitle">{subheadline}</p>
        </EditableAttribute>
      )}

      {cta?.url && (
        <EditableAttribute {section} attributeKey="cta">
          <a href={cta.url} class="hero__cta" target={cta.target}>
            {cta.label ?? cta.url}
          </a>
        </EditableAttribute>
      )}
    </div>
  </section>
</EditableSection>

<style>
  .hero {
    min-height: 60vh;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: center;
  }
  .hero__content { padding: 2rem; max-width: 1200px; margin: 0 auto; }
  .hero__title { font-size: clamp(2rem, 5vw, 4rem); }
  .hero__cta { display: inline-block; padding: .75rem 2rem; background: var(--proxima-primary); color: white; border-radius: var(--proxima-radius); }
</style>
```

---

## Paso 4 — Añadir al section router

```ts
// src/sections/index.ts
import HeroSection from './HeroSection.astro';
// ... otros imports

export const SECTION_MAP: Record<string, any> = {
  hero: HeroSection,    // ← añadir aquí
  // ...
};
```

---

## Los 9 tipos de atributos en práctica

### `text`

```astro
---
const { headline } = section.attributes;
---
<h1>{headline}</h1>
```

### `rich_text`

Devuelve HTML. Usar `set:html` de Astro:

```astro
---
const { body } = section.attributes;
---
<EditableAttribute {section} attributeKey="body">
  <div class="rich-text" set:html={body} />
</EditableAttribute>
```

### `image`

Devuelve una URL string:

```astro
---
const { banner_image } = section.attributes;
---
{banner_image && <img src={banner_image} alt="" loading="lazy" />}
```

### `link`

Devuelve `{ url: string, label?: string, target?: "_blank" | "_self" }`:

```astro
---
const { cta } = section.attributes;
---
{cta?.url && (
  <a href={cta.url} target={cta.target ?? '_self'}>
    {cta.label ?? 'Ver más'}
  </a>
)}
```

### `boolean`

```astro
---
const { show_price } = section.attributes;
---
{show_price && <span class="price">{product.price_formatted}</span>}
```

### `number`

```astro
---
const { columns } = section.attributes;   // e.g. 3
---
<div style={`grid-template-columns: repeat(${columns ?? 3}, 1fr)`}>
```

### `array`

Devuelve una lista de objetos. El schema define los campos de cada item:

```astro
---
// Ejemplo: array de items de FAQ
// attribute_schema: type=array, config.item_fields: [{ name: "question", type: "text" }, { name: "answer", type: "rich_text" }]
const { faq_items } = section.attributes;
---
<dl>
  {(faq_items ?? []).map((item, i) => (
    <div>
      <dt>{item.question}</dt>
      <dd set:html={item.answer} />
    </div>
  ))}
</dl>
```

### `object`

Similar a array pero es un solo objeto con campos anidados:

```astro
---
const { store_info } = section.attributes;
// store_info: { name: "Mi Tienda", phone: "999...", email: "..." }
---
<address>
  <p>{store_info?.name}</p>
  <p>{store_info?.phone}</p>
</address>
```

### `smart_collection_id`

El más potente — ver el [capítulo de Smart Collections](./05-smart-collections.md).

---

## Localización de atributos

Los atributos con `localizable: true` llegan ya resueltos en el idioma correcto.
La API resuelve el locale según el `Accept-Language` header de la composición.
**No tienes que hacer nada** — el valor ya es el string del locale actual.

Si por alguna razón necesitas acceder a otro locale:

```ts
// El valor bruto de un campo localizable en la base de datos es:
// { "es": "Bienvenido", "en": "Welcome" }
// La API ya resuelve y te entrega solo el string del locale activo.
const headline = section.attributes.headline; // → "Bienvenido" (si locale=es)
```

---

## Valores por defecto seguros

Los atributos pueden ser `undefined` si el comercio no los ha configurado.
Siempre usar valores por defecto para evitar errores en producción:

```ts
const {
  headline = 'Título por defecto',
  show_price = true,
  columns = 3,
  items = [],
} = section.attributes;
```

---

## Anatomía de un componente de sección completo

```astro
---
// src/sections/FeatureListSection.astro
import { EditableSection, EditableAttribute, EditableItem } from '@proxima-io/storefront-builder-sdk';
import type { CmsSection } from '@proxima-io/storefront-cms';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Props {
  section: CmsSection;
}

const { section } = Astro.props;
const {
  headline = '',
  features = [] as Feature[],
  columns = 3,
} = section.attributes;
---

<EditableSection {section}>
  <section class="features">
    <EditableAttribute {section} attributeKey="headline">
      <h2 class="features__title">{headline}</h2>
    </EditableAttribute>

    <div class="features__grid" style={`--cols: ${columns}`}>
      {features.map((feature, index) => (
        <EditableItem {section} attributeKey="features" itemIndex={index}>
          <article class="feature-card">
            <img src={feature.icon} alt="" class="feature-card__icon" />
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        </EditableItem>
      ))}
    </div>
  </section>
</EditableSection>

<style>
  .features__grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 3), 1fr);
    gap: 2rem;
  }
</style>
```

Los tres componentes del builder SDK:
- `EditableSection` — envuelve la sección completa (click para seleccionar en el tree)
- `EditableAttribute` — envuelve un campo editable (click para abrir el editor del campo)
- `EditableItem` — envuelve un item de un array (click para editar ese item específico)
