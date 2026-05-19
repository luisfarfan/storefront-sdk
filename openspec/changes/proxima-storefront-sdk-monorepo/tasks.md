## 1. Scaffold del monorepo

- [x] 1.1 Crear `package.json` raíz con `packageManager: pnpm@10`, workspaces `packages/*`, y scripts `build`, `test`, `typecheck`
- [x] 1.2 Crear `pnpm-workspace.yaml` declarando `packages: ["packages/*"]`
- [x] 1.3 Crear `turbo.json` con tasks `build`, `test`, `typecheck` con `dependsOn: ["^build"]` y outputs `dist/**`
- [x] 1.4 Crear `tsconfig.base.json` raíz con `strict: true`, `moduleResolution: bundler`, `target: ES2022`, `module: ESNext`
- [x] 1.5 Crear `.gitignore` con `node_modules`, `dist`, `.turbo`, `.proxima/registry`
- [x] 1.6 Inicializar git y hacer commit inicial

## 2. Paquete @proxima/storefront-cms

- [x] 2.1 Crear `packages/storefront-cms/` con `package.json` (`@proxima/storefront-cms`, `version: 0.1.0`, exports, peerDeps: none)
- [x] 2.2 Crear `tsconfig.json` extendiendo el base raíz
- [x] 2.3 Copiar y consolidar el código fuente desde `proxima-214store/packages/storefront-cms/src/` (versión más completa: `cms-preview.ts`, `create-storefront-api-client.ts`, `resolve-cms-tenant.ts`, `merge-product-item-overrides.ts`)
- [x] 2.4 Crear `src/index.ts` exportando todos los módulos
- [x] 2.5 Crear tests en `test/` para `normalizeCmsSection`, `isCmsPreview`, `resolveCmsTenantFromUrl`, `createStorefrontApiClient`
- [x] 2.6 Verificar que `pnpm build` y `pnpm test` pasan en el paquete

## 3. Paquete @proxima/storefront-core

- [ ] 3.1 Crear `packages/storefront-core/` con `package.json` (`@proxima/storefront-core`, `version: 0.1.0`)
- [ ] 3.2 Crear `tsconfig.json` extendiendo el base raíz
- [ ] 3.3 Copiar `src/index.ts` desde `proxima-managed-storefront-poc/packages/storefront-core/src/index.ts`
- [ ] 3.4 Crear tests para `fetchProximaWebsite`, `fetchProximaComposition`, `makeBuilderPreviewWebsite` con fetch mockeado
- [ ] 3.5 Verificar que `pnpm build` y `pnpm test` pasan

## 4. Paquete @proxima/storefront-commerce

- [ ] 4.1 Crear `packages/storefront-commerce/` con `package.json` (`@proxima/storefront-commerce`, `version: 0.1.0`)
- [ ] 4.2 Crear `tsconfig.json` extendiendo el base raíz
- [ ] 4.3 Copiar `src/index.ts` desde `proxima-managed-storefront-poc/packages/storefront-commerce/src/index.ts`
- [ ] 4.4 Mover los tipos centrales (`DeliveryMode`, `WebsiteKind`, `ResolverKind`, `WebsiteCapabilities`, `ThemeTokens`, `AnimationConfig`) a `src/types.ts` y exportarlos
- [ ] 4.5 Crear tests para `isCommerceResolver`
- [ ] 4.6 Verificar que `pnpm build` y `pnpm test` pasan

## 5. Paquete @proxima/storefront-builder-sdk

- [ ] 5.1 Crear `packages/storefront-builder-sdk/` con `package.json` (`@proxima/storefront-builder-sdk`, peerDependencies: `astro >= 5`)
- [ ] 5.2 Crear `tsconfig.json` extendiendo el base raíz
- [ ] 5.3 Copiar componentes Astro desde `proxima-managed-storefront-poc/packages/storefront-builder-sdk/src/`: `CmsPreviewBridge.astro`, `EditableSection.astro`, `EditableAttribute.astro`, `EditableItem.astro`
- [ ] 5.4 Copiar `src/index.ts` con todas las funciones utilitarias y tipos
- [ ] 5.5 Copiar `src/preview.css`
- [ ] 5.6 Configurar `exports` en `package.json` para exponer cada componente Astro, el index TS, y el CSS
- [ ] 5.7 Crear tests para `normalizeCmsSection`, `toSectionMeta`, `isCmsPreview`, `resolveCmsCompositionPageId`
- [ ] 5.8 Verificar que `pnpm typecheck` y `pnpm test` pasan (no hay build Astro, se distribuye source)

## 6. Paquete @proxima/template-schema

- [ ] 6.1 Crear `packages/template-schema/` con `package.json` (`@proxima/template-schema`, dependencies: `zod`)
- [ ] 6.2 Crear `tsconfig.json` extendiendo el base raíz
- [ ] 6.3 Copiar `src/index.ts` desde `proxima-website-template-catalog/packages/proxima-template-schema/src/index.ts`
- [ ] 6.4 Copiar tests existentes desde `proxima-website-template-catalog/packages/proxima-template-schema/test/`
- [ ] 6.5 Agregar tests para validación de claves sensibles y referencias a placeholders inválidos
- [ ] 6.6 Verificar que `pnpm build` y `pnpm test` pasan

## 7. Paquete @proxima/template-registry-client

- [ ] 7.1 Crear `packages/template-registry-client/` con `package.json` (`@proxima/template-registry-client`, sin dependencias externas)
- [ ] 7.2 Crear `tsconfig.json` extendiendo el base raíz
- [ ] 7.3 Copiar `src/index.ts` desde `proxima-website-template-catalog/packages/template-registry-client/src/index.ts`
- [ ] 7.4 Copiar tests existentes desde `proxima-website-template-catalog/packages/template-registry-client/test/`
- [ ] 7.5 Agregar test para redacción del token en errores
- [ ] 7.6 Verificar que `pnpm build` y `pnpm test` pasan

## 8. Paquete @proxima/templateizer (CLI)

- [ ] 8.1 Crear `packages/templateizer/` con `package.json` incluyendo `bin: { "proxima-templateizer": "./dist/index.js" }` y dependencies `@proxima/template-schema` y `@proxima/template-registry-client`
- [ ] 8.2 Crear `tsconfig.json` extendiendo el base raíz con references a template-schema y template-registry-client
- [ ] 8.3 Copiar `src/index.ts` desde `proxima-website-template-catalog/packages/templateizer/src/index.ts`
- [ ] 8.4 Ajustar imports para usar `@proxima/template-schema` y `@proxima/template-registry-client` en lugar de rutas relativas de workspace anterior
- [ ] 8.5 Copiar tests existentes y verificar que los imports son correctos
- [ ] 8.6 Verificar que `pnpm build` produce un `dist/index.js` ejecutable con shebang
- [ ] 8.7 Verificar que `node dist/index.js --help` funciona y `pnpm test` pasa

## 9. Verificación integral con Turborepo

- [ ] 9.1 Ejecutar `pnpm install` en la raíz y verificar que pnpm resuelve todas las dependencias internas
- [ ] 9.2 Ejecutar `turbo build` y verificar que buildea en el orden correcto (schema y registry-client antes que templateizer)
- [ ] 9.3 Ejecutar `turbo test` y verificar que todos los paquetes pasan sus tests
- [ ] 9.4 Ejecutar `turbo build` por segunda vez y verificar que usa caché (salida `FULL TURBO`)
- [ ] 9.5 Verificar que `proxima-templateizer --help` funciona ejecutando el bin compilado

## 10. Documentación

- [ ] 10.1 Crear `README.md` raíz con descripción del monorepo, lista de paquetes, tabla de consumidores, y comandos básicos (`pnpm install`, `turbo build`, `turbo test`)
- [ ] 10.2 Crear `README.md` por paquete con descripción, instalación, y ejemplos de uso mínimos
- [ ] 10.3 Documentar el protocolo postMessage del Builder SDK (mensajes entrantes y salientes) en el README de `storefront-builder-sdk`
