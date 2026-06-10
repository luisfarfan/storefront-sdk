# Proposal — Export Website Fixtures (CLI / SDK)

## Problema

El backend expondrá `GET /admin/cms/websites/export` para serializar CMS + catálogo sample. Falta el cliente que escriba esos payloads en el filesystem del repo y valide el bundle — el inverso operativo de `proxima deploy`.

## Solución

Nuevo comando **`proxima export fixtures [slug]`** (alias `export cms` en fase 1) en `@proxima-io/cli` / templateizer:

1. Resuelve workspace (`apps/{slug}/`) igual que deploy
2. Lee credenciales (`PROXIMA_SERVICE_KEY`, `PROXIMA_API_URL`, domain desde `.env` o flag)
3. Llama API export
4. Escribe archivos en paths estándar
5. Ejecuta `validateFixtureBundle()` — exit code ≠ 0 si inválido

## Fases

| Fase | Comando | Escribe |
|------|---------|---------|
| **1** | `proxima export fixtures tech-store --scope cms` | `proxima.website.json`, `src/fixtures/website.json`, `shell.json`, `compositions/*.json` |
| **2** | `--scope all` (default tras fase 2 API) | + `catalog-items.json`, `category-nav-tree.json`, `category-products.json`, `cart.json` |

## Cambios (SDK)

- `WebsiteExportClient` en `template-registry-client` (o paquete dedicado)
- `writeFixtureExport()` — writer con `--dry-run`, backup opcional
- Composition key registry compartido con API
- Registro en `packages/cli/src/index.ts` (`export` top-level o subcomando templateizer)
- Tests unitarios writer + integración mock HTTP

## No incluye

- Lógica de serialización CMS (vive en API)
- Git commit / PR automation

## Coordinación

| Repo | Rol |
|------|-----|
| proxima-api | Endpoint + serializers |
| proxima-storefront-sdk | Este change — client + CLI |
| proxima-storefronts | Scripts npm, docs, golden path tech-store |
