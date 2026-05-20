## Context

Hay tres repos consumidores con distintos perfiles:

**proxima-managed-storefront-poc** (npm workspaces):
- Runtime: `apps/managed-runtime` — usa `file:../../packages/*` para los 4 paquetes del SDK
- Workspaces raíz: `apps/*`, `packages/*`, `templates/*`, `sites/*`
- Los 4 paquetes locales a eliminar: `storefront-cms`, `storefront-core`, `storefront-commerce`, `storefront-builder-sdk`
- También tiene `packages/storefront-commerce` que actualmente exporta `normalizeCmsSections` — esa función en el SDK vive en `storefront-cms`

**proxima-website-template-catalog** (pnpm workspaces):
- El CLI (`templateizer`) ya importa de `@proxima/template-registry-client` y `@proxima/template-schema` via `workspace:*`
- Los 3 paquetes locales a eliminar: `proxima-template-schema`, `template-registry-client`, `templateizer`
- El repo quedaría sin packages propios — solo con `templates/` y `apps/catalog-preview`
- `pnpm-workspace.yaml` debe dejar de declarar `packages/*`

**proxima-214store** (npm workspaces):
- Solo tiene un paquete local: `packages/storefront-cms`
- El `package.json` raíz lo declara como `"@proxima/storefront-cms": "workspace:*"` — se reemplaza por `file:` al SDK

## Goals / Non-Goals

**Goals:**
- Cada repo consumidor instala `@proxima/*` apuntando al SDK local con `file:` relativo durante desarrollo.
- Los paquetes locales eliminados dejan de existir — no quedan archivos huérfanos.
- Todos los `pnpm install` / `npm install` en los repos migrados resuelven sin errores.
- Los dev servers y builds de los repos migrados siguen funcionando igual.

**Non-Goals:**
- No publicar en npm — el `file:` es suficiente para desarrollo local.
- No modificar ningún import de código fuente — los `@proxima/*` ya son correctos en todos los repos.
- No migrar `proxima-builder`, `proxima-admin`, `proxima-pos` — no consumen estos paquetes.

## Decisions

### Usar `file:` relativo para desarrollo local
En lugar de publicar en npm, se usa `file:../proxima-storefront-sdk/packages/<nombre>` en los `package.json` de los repos consumidores. Esto enlaza directamente al código fuente del SDK en disco.

Alternativa descartada: `npm link` / `pnpm link` — más frágil, requiere setup manual por dev.

### El PoC pasa de `file:../../packages/*` a `file:../../../proxima-storefront-sdk/packages/*`
El runtime está en `apps/managed-runtime/`, que está dos niveles abajo del repo raíz. El SDK está un nivel arriba del repo del PoC. La ruta relativa desde `apps/managed-runtime/` al SDK es `../../../proxima-storefront-sdk/packages/<pkg>`.

### template-catalog queda sin `packages/`
Los 3 paquetes que tenía son exactamente los que migran al SDK. El repo queda reducido a `templates/` (los Astro templates), `apps/catalog-preview`, y `docs/`. El `pnpm-workspace.yaml` se actualiza para eliminar `packages/*`.

### `normalizeCmsSections` del PoC
El PoC importa `normalizeCmsSections` desde `@proxima/storefront-cms`. En el SDK, `storefront-cms` tiene `normalizeCmsSection` (singular) pero no `normalizeCmsSections` (plural). Hay que verificar y agregar el alias si hace falta, o actualizar el import en el PoC.

## Risks / Trade-offs

- **Rutas `file:` largas** → Son frágiles si se mueve algún repo. Mitigation: documentar en README que los repos deben estar bajo el mismo directorio padre (`/proxima/`).
- **npm vs pnpm** → El PoC usa npm workspaces, el template-catalog usa pnpm. El `file:` funciona en ambos. Mitigation: testear `npm install` y `pnpm install` en cada repo después de la migración.
- **`normalizeCmsSections` faltante** → El PoC importa la versión plural que quizás no exista en el SDK. Mitigation: verificar y exportar desde `storefront-cms` si hace falta.

## Migration Plan

1. Verificar que `normalizeCmsSections` existe en el SDK — agregarla si no.
2. Migrar `proxima-managed-storefront-poc` — eliminar packages, actualizar deps.
3. Migrar `proxima-website-template-catalog` — eliminar packages, actualizar workspace config.
4. Migrar `proxima-214store` — eliminar package local, actualizar dep.
5. Verificar que cada repo instala y buildea sin errores.

Sin rollback necesario — los paquetes eliminados están preservados en el SDK.
