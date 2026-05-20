## Why

Los repos consumidores (`proxima-managed-storefront-poc`, `proxima-website-template-catalog`, `proxima-214store`) aún referencian sus paquetes locales via `workspace:*` o `file:../../packages/*`. Ahora que `proxima-storefront-sdk` existe como monorepo centralizado, esos paquetes locales deben eliminarse y reemplazarse por las dependencias `@proxima/*` del SDK. De lo contrario se mantiene la duplicación que motivó crear el SDK.

## What Changes

- **`proxima-managed-storefront-poc`**: Eliminar `packages/storefront-cms`, `packages/storefront-core`, `packages/storefront-commerce`, `packages/storefront-builder-sdk`. Actualizar `apps/managed-runtime/package.json` para apuntar a `workspace:*` del SDK via `file:` o directamente al SDK local durante desarrollo. Eliminar esos packages de los workspaces raíz.
- **`proxima-website-template-catalog`**: Eliminar `packages/proxima-template-schema`, `packages/template-registry-client`, `packages/templateizer`. Actualizar `packages/templateizer/package.json` para que sus dependencias apunten al SDK. Actualizar scripts raíz.
- **`proxima-214store`**: Eliminar `packages/storefront-cms` local. Actualizar el `package.json` raíz para depender de `@proxima/storefront-cms` del SDK.
- En todos los casos: reemplazar referencias `file:../../packages/*` y `workspace:*` locales por referencias al SDK usando `file:` apuntando al monorepo durante desarrollo local.

## Capabilities

### New Capabilities

- `poc-migration`: Eliminar paquetes locales del PoC y migrar el runtime Astro a consumir `@proxima/*` del SDK.
- `template-catalog-migration`: Eliminar paquetes locales del template catalog y migrar el CLI/tooling a consumir `@proxima/*` del SDK.
- `storefront-214-migration`: Eliminar el paquete `storefront-cms` local de la 214store y consumir `@proxima/storefront-cms` del SDK.

### Modified Capabilities

## Impact

- `proxima-managed-storefront-poc`: se eliminan 4 paquetes de `packages/`, se actualiza `apps/managed-runtime/package.json` y `package.json` raíz.
- `proxima-website-template-catalog`: se eliminan 3 paquetes de `packages/`, se actualizan los `package.json` afectados y scripts raíz.
- `proxima-214store`: se elimina 1 paquete de `packages/`, se actualiza `package.json` raíz.
- Ningún cambio de funcionalidad — solo cambio de origen de las dependencias.
- Para desarrollo local se usa `file:../proxima-storefront-sdk/packages/<pkg>` mientras no se publique en npm.
