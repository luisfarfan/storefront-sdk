## Why

En modo Inspeccionar del Builder, los wrappers CMS del storefront (`EditableSection`, `EditableAttribute`, `EditableItem`) apenas muestran outline al hover y casi nunca el **nombre del campo** que se va a editar. Los estilos están duplicados entre `preview.css` del SDK y layouts de cada tienda, y los clics en ítems de colección no siempre identifican el atributo padre. Esto dificulta editar sitios con muchas secciones y campos.

## What Changes

- **BREAKING (minor, v0.2.0):** nuevos `data-cms-*` en wrappers (`data-cms-inspect-title`, `data-cms-editor-kind`, `data-cms-item-parent-key`, etc.) y `preview.css` ampliado — las tiendas deben importar solo el CSS del SDK y eliminar overrides duplicados.
- Utilidades TS: `resolveEditorKind()`, `buildEditableAttributeProps()` desde `attributesMeta` (sin hardcode por `section_type`).
- `preview.css` unificado: badges en hover para sección / atributo / ítem, estados selected/highlight/tree-hover/draft, jerarquía visual, `prefers-reduced-motion`.
- `CmsPreviewBridge`: `parentAttributeKey` en `cms:select-item` (ya en código); soporte opcional `cms:set-inspect-labels` (`all` | `hover`).
- Limpieza en consumidores: quitar bloques CMS duplicados en `MainLayout.astro` (tienda-214) si importan `preview.css`.

## Capabilities

### New Capabilities

- `cms-inspect-chrome`: chrome visual y metadata de inspección para wrappers y bridge.

### Modified Capabilities

- `storefront-builder-sdk-package`: requisitos de estilos preview y atributos `data-cms-*` en componentes editables (delta en este change).

## Impact

- **Paquete:** `@proxima-io/storefront-builder-sdk` (componentes Astro, `preview.css`, `index.ts`, tests).
- **Consumidores:** `proxima-storefronts` (tienda-214, luma, atelier, nova-gear) — actualizar import CSS y opcionalmente usar `buildEditableAttributeProps`.
- **Builder:** sin cambios obligatorios; beneficia de mejor UX en iframe.
- **Versión:** bump `0.1.0` → `0.2.0` (cambio de contrato visual y data attributes).
