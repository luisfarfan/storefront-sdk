## Context

Actualmente el SDK de storefronts de Proxima está fragmentado en dos repos:
- `proxima-managed-storefront-poc/packages/` — 4 paquetes: storefront-cms, storefront-core, storefront-commerce, storefront-builder-sdk
- `proxima-website-template-catalog/packages/` — 3 paquetes: proxima-template-schema, template-registry-client, templateizer (CLI)

Cada storefront (managed runtime, 214store, futuros headless) copia o reimplementa partes de estos paquetes localmente. El `proxima-214store` tiene su propia versión de `storefront-cms` con más features que la del PoC. Esto genera divergencia y hace imposible versionar y publicar de forma coordinada.

El nuevo repo `proxima-storefront-sdk` centraliza los 7 paquetes como fuente de verdad, publicándolos en npm bajo `@proxima/*` para que cualquier storefront los instale como dependencias externas.

## Goals / Non-Goals

**Goals:**
- Monorepo único con los 7 paquetes bajo pnpm workspaces + Turborepo.
- Cada paquete se publica independientemente — los storefronts instalan solo lo que necesitan.
- TypeScript estricto en todos los paquetes. Solo `storefront-builder-sdk` tiene dependencia de Astro.
- Turborepo maneja el orden de build respetando dependencias entre paquetes.
- `@proxima/storefront-cms` consolida las features del PoC y de la 214store (la más completa).

**Non-Goals:**
- No migrar los repos consumidores (proxima-managed-storefront-poc, proxima-214store) en este cambio — eso es un paso posterior.
- No publicar en npm público por ahora — el scope `@proxima` puede ser un registry privado o GitHub Packages.
- No implementar adapters de deploy reales (Vercel, Cloudflare) en el CLI — ya existe la infraestructura en `deployment_config`.
- No agregar nuevos features a los paquetes extraídos — extractar el código existente sin modificarlo funcionalmente.

## Decisions

### pnpm workspaces como package manager
pnpm sobre npm/yarn porque ya es el package manager de `proxima-website-template-catalog` (tiene `pnpm-workspace.yaml`), maneja workspaces con `workspace:*` de forma limpia, y es más eficiente con dependencias compartidas.

Alternativa descartada: npm workspaces — ya se usa en el PoC pero pnpm es superior para monorepos con muchos paquetes.

### Turborepo como orquestador de tasks
Los paquetes tienen dependencias entre sí: `templateizer` depende de `template-schema` y `template-registry-client`. Sin orquestador, el build manual es propenso a errores. Turborepo resuelve el orden automáticamente con `"dependsOn": ["^build"]` y agrega caché de tasks.

Alternativa descartada: Nx — demasiado opinionado y pesado para 7 paquetes. Lerna — deprecado como standalone.

### Un tsconfig.base.json compartido en la raíz
Todos los paquetes extienden un `tsconfig.base.json` raíz con `strict: true`, `moduleResolution: bundler`, `target: ES2022`. Cada paquete tiene su propio `tsconfig.json` que solo define `rootDir`, `outDir`, y `references` específicas.

### storefront-builder-sdk mantiene componentes Astro
Los componentes `.astro` (EditableSection, EditableAttribute, EditableItem, CmsPreviewBridge) no se pueden transpolar a TypeScript puro sin perder su ergonomía. El paquete declara `astro` como peerDependency y exporta los componentes directamente. Solo los proyectos Astro pueden usarlo.

### storefront-cms consolida las dos versiones existentes
La versión del `proxima-214store` es un superset de la del PoC — tiene `createStorefrontApiClient`, `resolveCmsTenantFromUrl`, `getShellSectionMap`, y `mergeProductItemOverrides` que el PoC no tiene. El paquete extraído usa la versión más completa como base.

### Vitest como test runner unificado
Todos los paquetes usan Vitest. Ya lo usan ambos repos fuente. Turborepo llama `vitest run` en cada paquete de forma cacheada.

## Risks / Trade-offs

- **Divergencia de storefront-cms** → La versión del `proxima-214store` tiene `attribute_definition_id` en `attributes_meta` que el PoC no tiene. Se mantiene el campo como opcional para no romper el PoC. Mitigation: el tipo es compatible hacia atrás.
- **Astro como peerDependency** → Si Astro cambia su API de componentes, `storefront-builder-sdk` puede romper. Mitigation: pinear el peer a `astro >= 5` y testear contra la versión del runtime managed.
- **Publicación en npm privado** → Requiere configurar `.npmrc` con el registry y token. Mitigation: documentar en README, los CI de los repos consumidores ya manejan esto.
- **Turborepo cache en CI** → La caché local no se comparte entre CI runs sin configurar remote cache. Mitigation: aceptable por ahora, el build de 7 paquetes es rápido. Remote cache (Vercel) se puede agregar después.

## Migration Plan

1. Crear el monorepo `proxima-storefront-sdk` con el scaffold base.
2. Copiar y ajustar los 7 paquetes al nuevo repo.
3. Verificar que `turbo build` y `turbo test` pasan en todos los paquetes.
4. Publicar versiones `0.1.0` de los 7 paquetes.
5. (Paso posterior, fuera de scope) Actualizar `proxima-managed-storefront-poc` y `proxima-website-template-catalog` para importar desde npm en lugar de workspace local.

No hay rollback necesario — los repos fuente no se modifican en este cambio.

## Open Questions

- ¿El registry de publicación es npm público, GitHub Packages, o un registry privado propio?
- ¿Los paquetes del storefront-builder-sdk necesitan un build step de Astro o se distribuyen como source `.astro` directamente?
- ¿`storefront-core` y `storefront-cms` deberían fusionarse dado que storefront-cms ya incluye el API client factory?
