# 06 — Builder Integration

Cómo conectar el storefront con el Proxima Builder para edición en tiempo real.

---

## ¿Qué es el Builder?

El Proxima Builder es un iframe que carga tu storefront en "preview mode".
El comercio puede hacer click en cualquier elemento editable, editar el contenido,
y ver los cambios en tiempo real — sin recargar la página.

La comunicación entre el Builder (parent) y el storefront (iframe) ocurre
via `window.postMessage`.

```
┌─────────────────────────────────────────────────────┐
│  Proxima Admin                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │  Section tree       │  │  Attribute editor   │   │
│  │  ──────────────     │  │  ──────────────      │   │
│  │  • Header           │  │  headline: "Bien..." │   │
│  │  • Hero ←selected   │  │  subheadline: "Los.."│   │
│  │  • Product Grid     │  │                     │   │
│  └─────────────────────┘  └─────────────────────┘   │
│                                                       │
│  ┌───────────────────────────────────────────────┐   │
│  │  iframe → tu storefront en preview mode       │   │
│  │                                               │   │
│  │  [Header]                                     │   │
│  │  [Hero ── con outline azul porque selected]   │   │
│  │  [Product Grid]                               │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Setup en BaseLayout

El `CmsPreviewBridge` debe estar en el layout base. Solo activa la comunicación
cuando el storefront está en preview mode:

```astro
---
// src/layouts/BaseLayout.astro
import { CmsPreviewBridge } from '@proxima-io/storefront-builder-sdk';
import { isCmsPreview } from '@proxima-io/storefront-cms';

const isPreview = isCmsPreview(Astro.url);
---

<body>
  <!-- Solo active en preview; noop en producción -->
  <CmsPreviewBridge enabled={isPreview} />
  <slot />
</body>
```

### ¿Cómo detecta el preview mode?

`isCmsPreview(url)` devuelve `true` si la URL contiene `?proxima_preview=1`
(o el query param configurado). El Builder siempre añade este param al cargar
el iframe.

En producción el param no existe → `isPreview = false` → cero overhead.

---

## `EditableSection` — Seleccionar una sección

Envuelve **toda** la sección. Al hacer click, el Builder selecciona esa sección
en el árbol lateral.

```astro
---
import { EditableSection } from '@proxima-io/storefront-builder-sdk';
import type { CmsSection } from '@proxima-io/storefront-cms';

interface Props { section: CmsSection }
const { section } = Astro.props;
---

<EditableSection {section}>
  <section class="hero">
    <!-- contenido -->
  </section>
</EditableSection>
```

En producción (sin `CmsPreviewBridge`), `EditableSection` es un pass-through
transparente — no añade ningún DOM extra ni scripts.

---

## `EditableAttribute` — Editar un campo

Envuelve un elemento editable. Al hacer click, el Builder abre el editor del campo.

```astro
<EditableSection {section}>
  <section class="hero">

    <EditableAttribute {section} attributeKey="headline">
      <h1>{section.attributes.headline}</h1>
    </EditableAttribute>

    <EditableAttribute {section} attributeKey="subheadline">
      <p>{section.attributes.subheadline}</p>
    </EditableAttribute>

  </section>
</EditableSection>
```

**Regla:** No envolver todo con `EditableAttribute` — solo los elementos que
el comercio debe poder editar individualmente. Un elemento con `EditableAttribute`
puede contener múltiples elementos HTML; el click en cualquiera de ellos abre el
editor de ese atributo.

---

## `EditableItem` — Editar un item de un array

Para atributos de tipo `array`, cada item tiene su propio editor.
`EditableItem` le dice al Builder cuál item está siendo editado:

```astro
---
const { features = [] } = section.attributes;
---

<EditableSection {section}>
  <div class="features">
    {features.map((feature, index) => (
      <EditableItem {section} attributeKey="features" itemIndex={index}>
        <article class="feature-card">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </article>
      </EditableItem>
    ))}
  </div>
</EditableSection>
```

---

## Props de los componentes builder

| Componente | Props | Descripción |
|-----------|-------|-------------|
| `EditableSection` | `section: CmsSection` | La sección completa |
| `EditableAttribute` | `section: CmsSection`, `attributeKey: string` | El nombre del atributo en `section.attributes` |
| `EditableItem` | `section: CmsSection`, `attributeKey: string`, `itemIndex: number` | Para arrays, el índice del item |

---

## Cómo funciona internamente

### En preview mode:

1. `CmsPreviewBridge` escucha mensajes del Builder (parent)
2. `EditableSection` añade `data-proxima-section-id={section.id}` al DOM
3. `EditableAttribute` añade `data-proxima-attribute={attributeKey}` al DOM
4. Al hacer click en un elemento, el bridge detecta el atributo más cercano
   y envía un `postMessage` al Builder con `{ sectionId, attributeKey }`
5. El Builder resalta la sección y abre el editor del atributo

### Actualización en tiempo real:

Cuando el comercio edita un campo:
1. El Builder envía `{ type: "PROXIMA_PATCH", sectionId, attributeKey, value }` al iframe
2. `CmsPreviewBridge` intercepta el mensaje
3. El bridge actualiza el DOM directamente para campos simples (text, rich_text, image)
4. Para cambios complejos (smart_collection, array), el bridge fuerza un reload del iframe

---

## postMessage — protocolo completo

Si necesitas reaccionar a eventos del Builder en tu código client-side:

```ts
// src/components/SomeInteractiveComponent.ts
window.addEventListener('message', (event) => {
  // Verificar origen
  if (!event.origin.includes('proxima')) return;

  const { type, payload } = event.data ?? {};

  switch (type) {
    case 'PROXIMA_SECTION_SELECTED':
      // El Builder seleccionó una sección
      // payload: { sectionId: number }
      break;

    case 'PROXIMA_ATTRIBUTE_UPDATED':
      // El Builder actualizó un atributo
      // payload: { sectionId: number, attributeKey: string, value: unknown }
      break;

    case 'PROXIMA_SECTION_ADDED':
      // El comercio añadió una nueva sección
      // El bridge hace reload automáticamente
      break;

    case 'PROXIMA_PREVIEW_READY':
      // El Builder está listo para recibir eventos del storefront
      break;
  }
});
```

> La mayoría de storefronts no necesitan escuchar estos eventos directamente.
> `CmsPreviewBridge` lo maneja internamente.

---

## Atributos de imagen — edición inline

Las imágenes con `type: "image"` se editan con click en el Builder.
Para que el Builder pueda mostrar el overlay de edición en la imagen:

```astro
<EditableAttribute {section} attributeKey="banner_image">
  <!-- La imagen debe estar DENTRO del EditableAttribute -->
  {section.attributes.banner_image
    ? <img src={section.attributes.banner_image} alt="Banner" />
    : <div class="placeholder">Sin imagen</div>
  }
</EditableAttribute>
```

---

## Preview mode — comportamientos especiales

En preview mode, el storefront puede necesitar mostrar placeholders para
atributos vacíos:

```astro
---
import { isCmsPreview } from '@proxima-io/storefront-cms';
const isPreview = isCmsPreview(Astro.url);
const { headline } = section.attributes;
---

<EditableAttribute {section} attributeKey="headline">
  <h1 class:list={[{ 'is-empty': !headline && isPreview }]}>
    {headline || (isPreview ? '— Añadir título —' : '')}
  </h1>
</EditableAttribute>

<style>
  .is-empty {
    border: 2px dashed #ccc;
    color: #aaa;
    padding: 0.5rem;
    min-height: 2rem;
  }
</style>
```

---

## Secciones sin edición (header, footer)

Si una sección tiene atributos muy complejos o no necesita edición inline,
puedes usar solo `EditableSection` sin `EditableAttribute`:

```astro
<EditableSection {section}>
  <!-- Todo el contenido del header aquí, sin EditableAttribute -->
  <!-- El comercio edita los atributos del header desde el panel lateral -->
  <header>...</header>
</EditableSection>
```

---

## Checklist de Builder Integration

- [ ] `CmsPreviewBridge` está en `BaseLayout.astro` con `enabled={isPreview}`
- [ ] `isCmsPreview(Astro.url)` determina `isPreview`
- [ ] Cada sección tiene `<EditableSection {section}>`
- [ ] Cada campo editable tiene `<EditableAttribute {section} attributeKey="...">`
- [ ] Cada item de array tiene `<EditableItem {section} attributeKey="..." itemIndex={i}>`
- [ ] En producción, no hay overhead del builder (todo es noop)
