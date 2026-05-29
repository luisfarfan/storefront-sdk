# @proxima-io/storefront-builder-sdk

Bridge entre el storefront Astro y el Builder visual de Proxima. Permite que el comercio edite secciones y atributos en tiempo real desde el iframe del Builder.

## Instalación

```bash
pnpm add @proxima-io/storefront-builder-sdk
```

## Componentes Astro

### `<CmsPreviewBridge />`

Inyecta el script de comunicación postMessage entre el storefront y el Builder. **Incluir una sola vez en el layout principal**, dentro del `<head>` o al final del `<body>`.

```astro
---
import { CmsPreviewBridge } from '@proxima-io/storefront-builder-sdk';
---
<CmsPreviewBridge />
```

### `<EditableSection sectionId={...}>`

Wrapper que marca una sección como editable en el Builder. Cuando el comercio hace hover sobre ella en el Builder, aparece el overlay de edición.

```astro
---
import { EditableSection } from '@proxima-io/storefront-builder-sdk';
---
{sections.map(section => (
  <EditableSection sectionId={section.id}>
    <!-- Tu componente de sección aquí -->
  </EditableSection>
))}
```

### `<EditableAttribute sectionId={...} attributeName={...}>`

Marca un atributo individual como editable. El Builder permite editar ese campo específico con un click directo en el elemento.

```astro
---
import { EditableAttribute } from '@proxima-io/storefront-builder-sdk';
---
<EditableAttribute sectionId={section.id} attributeName="headline">
  <h1>{section.attributes.headline}</h1>
</EditableAttribute>
```

### `<EditableItem sectionId={...} itemIndex={...}>`

Para atributos de tipo `array` — marca un item específico dentro del array como editable.

```astro
{section.attributes.items.map((item, i) => (
  <EditableItem sectionId={section.id} itemIndex={i}>
    <div>{item.title}</div>
  </EditableItem>
))}
```

### `<BuilderEmptyState />`

Placeholder que el Builder muestra cuando una sección no tiene contenido configurado todavía. Guía al comercio a agregar contenido desde el panel.

```astro
{!section.attributes.headline && <BuilderEmptyState />}
```

## Utilidades TypeScript

### `isCmsPreview()`

Devuelve `true` si el storefront está corriendo dentro del iframe del Builder.

```ts
import { isCmsPreview } from '@proxima-io/storefront-builder-sdk';

if (isCmsPreview()) {
  // Deshabilitar analytics, mostrar overlays de edición, etc.
}
```

### `getPreviewRobots()`

Devuelve `"noindex, nofollow"` cuando está en preview, `undefined` en producción. Útil para el meta robots tag.

```astro
---
import { getPreviewRobots } from '@proxima-io/storefront-builder-sdk';
const robots = getPreviewRobots();
---
{robots && <meta name="robots" content={robots} />}
```

### Helpers de inspect

Para casos avanzados donde necesitas construir los metadatos de edición manualmente:

```ts
import {
  toSectionMeta,
  getAttributeMeta,
  buildEditableAttributeProps,
} from '@proxima-io/storefront-builder-sdk';
```

## Cómo funciona

El Builder carga el storefront en un `<iframe>`. El SDK usa `postMessage` para comunicarse con el Builder cuando el comercio:

1. Hace hover sobre una sección → el Builder resalta el panel de esa sección
2. Hace click en un atributo editable → el Builder abre el editor de ese campo
3. Reordena secciones → el storefront recibe el nuevo orden y re-renderiza

En modo producción (fuera del Builder) todos los wrappers son transparentes y no afectan el rendimiento ni el HTML final.

## Relación con otros paquetes

```
storefront-builder-sdk
  └── usa storefront-cms para normalización y detección de preview
  └── se integra con storefront-core (las secciones vienen de fetchProximaComposition)
```
