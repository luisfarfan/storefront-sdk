## Context

Los componentes editables viven en `packages/storefront-builder-sdk/src/*.astro`. El bridge `CmsPreviewBridge.astro` comunica clics al Builder. Los labels deben venir del API (`attributes_meta.label`, `type`, `config.ui`) — nunca de nombres de sección hardcodeados.

## Goals / Non-Goals

**Goals:**

- En modo `edit`, hover muestra badge con título legible + kind (texto, colección, lista, …).
- Tres niveles visuales distinguibles: sección (cyan), atributo (sky), ítem (pink).
- Un solo `preview.css` en el SDK; consumidores no duplican reglas.
- Helpers TS para props consistentes desde `attributesMeta`.

**Non-Goals:**

- Cambiar protocolo postMessage del Builder más allá de `cms:set-inspect-labels` opcional.
- Iconos SVG por sección específica.
- Traducir kinds a todos los idiomas (strings en español en CSS `attr()` vía data attributes generados en Astro).

## Decisions

### D1: `data-cms-inspect-title` como string listo para CSS

**Decision:** Los componentes Astro computan `inspectTitle` (label + kind opcional) y lo exponen en `data-cms-inspect-title` para `content: attr(...)` en pseudo-elementos.

**Rationale:** CSS no puede componer strings complejos; Astro sí tiene acceso a meta.

### D2: `resolveEditorKind(type, ui?)` genérico

**Decision:** Mapa por tipo CMS: `smart_collection_id` → `collection`, `array` → `list`, `image` → `media`, etc. `config.ui` se expone en `data-cms-attribute-ui` sin interpretar cada ui en CSS.

### D3: Versión 0.2.0

**Decision:** Bump minor. No rompe imports, pero CSS/layouts que overrideaban selectores pueden verse distintos — aceptable en desarrollo.

### D4: `cms:set-inspect-labels`

**Decision:** `body[data-cms-inspect-labels='all']` muestra badges sin hover; default `hover`.

## Risks / Trade-offs

- **[Risk] Badges tapados en layouts densos** → `z-index` escalonado + posición top-left con `max-width`.
- **[Risk] Doble CSS si no se limpia MainLayout** → documentar en tasks remover duplicados.

## Migration Plan

1. Publicar SDK `0.2.0`.
2. En cada storefront: asegurar `import '@proxima-io/storefront-builder-sdk/preview.css'`; eliminar bloques CMS duplicados en layouts.
3. Opcional: adoptar `buildEditableAttributeProps(meta, name)` en section components.
4. Reiniciar dev server del storefront + hard refresh Builder.
