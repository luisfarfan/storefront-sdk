## 1. Preparar el SDK

- [ ] 1.1 Verificar que `@proxima/storefront-cms` exporta `normalizeCmsSections` (plural) — el PoC lo importa así
- [ ] 1.2 Agregar `normalizeCmsSections` como alias en `storefront-cms/src/index.ts` si no existe
- [ ] 1.3 Buildear `@proxima/storefront-cms` y confirmar que el export está disponible en `dist/`

## 2. Migrar proxima-managed-storefront-poc

- [ ] 2.1 Actualizar `apps/managed-runtime/package.json` — reemplazar los 4 `file:../../packages/*` por `file:../../../proxima-storefront-sdk/packages/*`
- [ ] 2.2 Eliminar `packages/storefront-cms/` del PoC
- [ ] 2.3 Eliminar `packages/storefront-core/` del PoC
- [ ] 2.4 Eliminar `packages/storefront-commerce/` del PoC
- [ ] 2.5 Eliminar `packages/storefront-builder-sdk/` del PoC
- [ ] 2.6 Actualizar `package.json` raíz del PoC — eliminar `"packages/*"` de workspaces si ya no hay paquetes
- [ ] 2.7 Ejecutar `npm install` en el PoC y verificar que resuelve sin errores

## 3. Migrar proxima-website-template-catalog

- [ ] 3.1 Actualizar `package.json` raíz — agregar `@proxima/templateizer` como devDependency con `file:../proxima-storefront-sdk/packages/templateizer`
- [ ] 3.2 Actualizar script `validate` en `package.json` raíz para usar el CLI del SDK
- [ ] 3.3 Eliminar `packages/templateizer/` del template-catalog
- [ ] 3.4 Eliminar `packages/template-registry-client/` del template-catalog
- [ ] 3.5 Eliminar `packages/proxima-template-schema/` del template-catalog
- [ ] 3.6 Actualizar `pnpm-workspace.yaml` — eliminar `packages/*` del listado de workspaces
- [ ] 3.7 Ejecutar `pnpm install` en el template-catalog y verificar que resuelve sin errores
- [ ] 3.8 Ejecutar `proxima-templateizer validate templates/ecommerce-standard` y confirmar que pasa

## 4. Migrar proxima-214store

- [ ] 4.1 Actualizar `package.json` raíz — reemplazar `"@proxima/storefront-cms": "workspace:*"` por `"file:../proxima-storefront-sdk/packages/storefront-cms"`
- [ ] 4.2 Eliminar `packages/storefront-cms/` de la 214store
- [ ] 4.3 Actualizar `package.json` raíz — eliminar `"packages/*"` de workspaces
- [ ] 4.4 Ejecutar `npm install` en la 214store y verificar que resuelve sin errores
- [ ] 4.5 Ejecutar `npm run typecheck` en la 214store y confirmar sin errores de tipo

## 5. Verificación final

- [ ] 5.1 Confirmar que `proxima-managed-storefront-poc` ya no tiene ningún directorio bajo `packages/`
- [ ] 5.2 Confirmar que `proxima-website-template-catalog` ya no tiene ningún directorio bajo `packages/`
- [ ] 5.3 Confirmar que `proxima-214store` ya no tiene ningún directorio bajo `packages/`
- [ ] 5.4 Hacer commit en cada repo con el mensaje de migración
