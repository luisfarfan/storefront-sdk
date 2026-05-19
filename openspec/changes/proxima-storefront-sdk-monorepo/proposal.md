## Why

El código de SDK de storefronts y el CLI de templates están duplicados y dispersos entre `proxima-managed-storefront-poc` y `proxima-website-template-catalog`, lo que hace imposible que múltiples storefronts (el runtime managed, la 214store, futuros headless externos) compartan una sola fuente de verdad. Se necesita un monorepo independiente que centralice todos estos paquetes para que cada website los consuma como dependencias versionadas.

## What Changes

- Crear el monorepo `proxima-storefront-sdk` con pnpm workspaces + Turborepo.
- Extraer `storefront-cms` del `proxima-managed-storefront-poc` como `@proxima/storefront-cms`.
- Extraer `storefront-core` del `proxima-managed-storefront-poc` como `@proxima/storefront-core`.
- Extraer `storefront-commerce` del `proxima-managed-storefront-poc` como `@proxima/storefront-commerce`.
- Extraer `storefront-builder-sdk` del `proxima-managed-storefront-poc` como `@proxima/storefront-builder-sdk` (TypeScript + componentes Astro).
- Extraer `proxima-template-schema` del `proxima-website-template-catalog` como `@proxima/template-schema`.
- Extraer `template-registry-client` del `proxima-website-template-catalog` como `@proxima/template-registry-client`.
- Extraer `templateizer` del `proxima-website-template-catalog` como `@proxima/templateizer` (CLI).
- Configurar Turborepo para orquestar builds en el orden correcto respetando dependencias entre paquetes.
- Cada paquete se publica de forma independiente en npm bajo el scope `@proxima`.

## Capabilities

### New Capabilities

- `monorepo-scaffold`: Estructura base del monorepo con pnpm workspaces, Turborepo, TypeScript base config compartido, y scripts raíz.
- `storefront-cms-package`: Paquete `@proxima/storefront-cms` — normalización de composiciones CMS (secciones, atributos, tenant resolution, preview detection, API client factory).
- `storefront-core-package`: Paquete `@proxima/storefront-core` — cliente HTTP para los endpoints de Proxima API (websites, compositions, products).
- `storefront-commerce-package`: Paquete `@proxima/storefront-commerce` — helpers de commerce (detección de rutas de commerce, capabilities).
- `storefront-builder-sdk-package`: Paquete `@proxima/storefront-builder-sdk` — bridge postMessage iframe con Proxima Builder + componentes Astro editables (EditableSection, EditableAttribute, EditableItem, CmsPreviewBridge) + estilos CSS de preview.
- `template-schema-package`: Paquete `@proxima/template-schema` — schema Zod para validar `proxima.template.json`, tipos TypeScript del manifest, helpers de validación.
- `template-registry-client-package`: Paquete `@proxima/template-registry-client` — HTTP client para los endpoints admin de website-templates en proxima-api (CRUD, publish, status).
- `templateizer-cli-package`: Paquete `@proxima/templateizer` — CLI Node.js con comandos scan, validate, register, deploy, publish, sync, status para gestionar templates contra la API.

### Modified Capabilities

## Impact

- `proxima-managed-storefront-poc`: Los 4 paquetes de `packages/` pasan a ser dependencias externas. El runtime Astro importa `@proxima/*` desde npm en lugar de workspace local.
- `proxima-website-template-catalog`: Los 3 paquetes de `packages/` pasan a ser dependencias externas. Los templates importan `@proxima/*` desde npm.
- `proxima-214store`: Su `packages/storefront-cms` local puede ser reemplazado por `@proxima/storefront-cms` que tiene un superset de funcionalidad.
- Futuros storefronts headless externos: pueden instalar solo los paquetes que necesitan (`@proxima/storefront-cms`, `@proxima/storefront-builder-sdk`) sin arrastrar el CLI ni el template-schema.
