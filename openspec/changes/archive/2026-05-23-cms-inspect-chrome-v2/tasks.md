## 1. SDK — metadata y utilidades

- [x] 1.1 Añadir `inspect-meta.ts` con `resolveEditorKind`, `buildEditableAttributeProps`, helpers de título
- [x] 1.2 Exportar utilidades desde `index.ts`
- [x] 1.3 Tests unitarios para `resolveEditorKind` y `buildEditableAttributeProps`

## 2. SDK — componentes Astro

- [x] 2.1 Actualizar `EditableSection.astro` con `data-cms-inspect-title` / `data-cms-inspect-kind`
- [x] 2.2 Actualizar `EditableAttribute.astro` con metadata completa
- [x] 2.3 Actualizar `EditableItem.astro` con `parentAttributeKey` e inspect title

## 3. SDK — estilos y bridge

- [x] 3.1 Reescribir `preview.css` con chrome completo (hover badges, estados, reduced motion)
- [x] 3.2 `CmsPreviewBridge`: handler `cms:set-inspect-labels`
- [x] 3.3 Confirmar `parentAttributeKey` en `cms:select-item`

## 4. Consumidores y versión

- [x] 4.1 Bump versión paquete a `0.2.0`
- [x] 4.2 Limpiar CSS CMS duplicado en `tienda-214` MainLayout (mantener solo import SDK)
- [x] 4.3 Verificar SiteLayout de otras apps importan `preview.css` (tienda-214, luma, atelier, nova-gear)

## 5. QA

- [x] 5.1 `pnpm test` en storefront-builder-sdk
- [x] 5.2 Manual: preview tienda-214 en Builder modo Inspeccionar — hover badges visibles (reiniciar dev storefront)
