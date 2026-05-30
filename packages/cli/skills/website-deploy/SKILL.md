---
name: website-deploy
description: >
  Hacer deploy del manifiesto proxima.website.json de un storefront a la API de Proxima,
  o diagnosticar errores del deploy. Usar cuando el usuario quiere: "hacer deploy",
  "subir las secciones", "el Builder no muestra mis secciones", "por qué falla el deploy",
  "404 en el deploy", "409 breaking changes", "actualizar el manifiesto en la API",
  "proxima init", "subir template al marketplace".
---

# Skill: website-deploy

> **Instalación:** `proxima skills install website-deploy` · Docs: `09-deploy.md`, `01-mental-model.md`

Sincroniza el `proxima.website.json` de un app con la API de Proxima para que el
Builder pueda mostrar las secciones y el comercio pueda editar contenido.

CLI: **`@proxima-io/cli`** (bin global `proxima`) — descubre workspaces del monorepo y delega al engine `@proxima-io/templateizer`.

```bash
npm install -g @proxima-io/cli
```

En este monorepo (sin `-g`): `npm install` en la raíz expone `npm run proxima -- <comando>`.

---

## Identificar el app a deployar

```bash
proxima list
```

Muestra slug, dominio, puerto, credenciales y path. Si el usuario no especifica app, usar **`proxima list`** o **AskUserQuestion**.

Apps típicas en este monorepo:
- **`214store`** — golden template (4325)
- **`nocturna`** — licorería demo (4326)
- `devhub` — no tiene `proxima.website.json` (no aparece en `proxima list`)

Los comandos aceptan **slug** (`214store`) o **path** (`apps/214store`). Dentro de `apps/{slug}/`, el slug es opcional.

### Deploy vs seed (no confundir)

| Herramienta | Qué sube | Qué **no** hace |
|-------------|----------|------------------|
| **`proxima deploy`** (`website-deploy`) | `section_types` → `WebsiteSectionType`, páginas vacías si faltan, `shell_sections` si faltan | Contenido del home, catálogo, smart collections, valores del shell |
| **`seed_214store_website.py`** (solo 214store, en `proxima-api`) | Business, website, catálogo, home con valores, shell desde `fixtures/shell.json` | Schemas por-website del Builder (hay que correr deploy después) |
| **`proxima template:create`** | Registro idempotente del template en el marketplace (admin registry) | Deploy a un website de cliente concreto |

**Orden local 214store:** seed → `proxima deploy 214store`. Ver `apps/214store/docs/DEPLOY.md`.

Tras un seed, el `website_id` cambia. Si el deploy devuelve **403 Access denied**, la service account sigue apuntando al website viejo. El seed de 214store **re-enlaza** las accounts del business.

---

## Setup de credenciales (primera vez)

### Opción A — Wizard interactivo (recomendado)

```bash
proxima init 214store
# o desde apps/214store: proxima init
```

El wizard:
- Pregunta API URL, domain, service key (input oculto), template key (opcional)
- Usa valores de `.env` existente como defaults
- Crea `apps/{slug}/.proxima/credentials.json`
- Agrega `.proxima/credentials.json` al `.gitignore` del app (si existe)

**Nunca commitear** `.proxima/credentials.json` — el monorepo ya ignora `**/.proxima/credentials.json` en la raíz.

Formato del archivo:

```json
{
  "api_url": "http://localhost:8000",
  "domain": "214store.localhost",
  "service_key": "pxa_test_...",
  "template_key": "214store"
}
```

### Opción B — Variables de entorno / `.env`

```env
PROXIMA_API_URL=http://localhost:8000
PROXIMA_DOMAIN=214store.localhost      # alias: PROXIMA_WEBSITE_DOMAIN
PROXIMA_SERVICE_KEY=pxa_test_...
PROXIMA_TEMPLATE_KEY=214store          # solo template-create / marketplace
```

### Prioridad de resolución (SDK templateizer)

```
CLI flags  >  process.env  >  .proxima/credentials.json  >  .env
```

Override puntual:

```bash
proxima deploy 214store --domain otro-dominio.localhost --service-key pxa_test_...
proxima deploy nocturna --credentials ~/secrets/cliente-a.json
```

---

## Pre-flight: verificar que todo está listo

```bash
# 1. Workspaces y credenciales
proxima list

# 2. ¿Section types en sync con SECTION_REGISTRY?
grep '"key"' apps/{slug}/proxima.website.json
grep "SECTION_REGISTRY" apps/{slug}/src/components/sections/SectionRenderer.astro

# 3. Validar schema del manifiesto
proxima validate {slug}

# 4. Rutas Caddy (opcional)
proxima caddy check
```

Los `key` en `proxima.website.json` deben coincidir exactamente con los keys en `SECTION_REGISTRY`.

### `attribute_schema` en el manifiesto

El deploy sube **`section_types[].attribute_schema`** a `WebsiteSectionType` (por website). Es la fuente de verdad del Builder.

- Guía: **`proxima-storefront-sdk/docs/07-cms-attribute-schema.md`**
- Ejemplo completo: `apps/214store/proxima.website.json`

---

## Ejecutar el deploy

Desde la **raíz del monorepo** (recomendado):

```bash
# 1. Preview (sin API)
proxima deploy 214store --dry-run

# 2. Deploy interactivo — resumen + "Continue?" + spinner
proxima deploy 214store

# 3. Deploy sin prompts (CI / scripts)
proxima deploy 214store --yes

# 4. Una sola página
proxima website-deploy 214store --page /contacto
proxima website-deploy nocturna --page product_detail --page /blog

# 5. Breaking changes (409) — forzar sin prompt interactivo
proxima deploy 214store --force
```

> En TTY interactivo, un **409 breaking changes** pregunta si aplicar `--force`. En CI (`CI=1`, `GITHUB_ACTIONS=1`, `NO_INTERACTIVE=1`) los prompts se omiten — usar `--force` o `--yes` explícitamente.

### Comportamiento interactivo (`website-deploy`)

| Paso | Interactivo (local) | CI / `--yes` |
|------|---------------------|--------------|
| Resumen pre-deploy | Pide confirmación `Continue?` | Salta con `--yes` |
| Llamada API | Spinner animado | Igual |
| 409 breaking changes | Pregunta si aplicar `--force` | Falla — re-ejecutar con `--force` |

### Comandos avanzados (passthrough a templateizer)

```bash
proxima website-deploy 214store --dry-run
proxima template-create 214store --publish-manifest --local-only
proxima template:publish 214store --local-only   # alias
```

---

## Subir template al marketplace (`template-create`)

Para registrar/actualizar el **WebsiteTemplate** en el admin registry (no confundir con deploy a un website de cliente):

```bash
proxima template:create 214store --dry-run
proxima template:publish 214store --local-only    # dev sin S3
proxima template:publish 214store --s3-bucket proxima-prod-...   # prod
```

Requiere `template_key` en credentials JSON o `.env` (`PROXIMA_TEMPLATE_KEY`).

`template:deploy` sigue siendo el comando **legacy** (structure inline en DB): `proxima template-deploy {slug}`.

---

## Output esperado (deploy exitoso)

```
✓ Connected to 214store.localhost (website #X)

Section types
  + created    hero_bento
  ~ updated    product_grid  (1 attribute changed)
  · unchanged  promo_marquee

Pages
  + created    /  →  scaffolded [hero_bento, product_grid]
  · skipped    product_detail  (has merchant sections — not modified)

✓ Deploy completed
```

---

## Diagnóstico de errores

### `404 — Website not found`

El `domain` en credenciales / `.env` no coincide con ningún website en la API.

**Causas:** website no creado en admin, typo en dominio, entorno staging vs prod.

### `403 — Not authorized`

1. `business_id` del token ≠ dueño del website
2. `website_id` desactualizado tras seed/recreación del website
3. Scope faltante: `cms:websites:write`

### `409 — Breaking changes detected`

Cambio de `type` o `name` de atributo ya deployado.

**Opciones:**
1. Revertir cambio en `proxima.website.json`
2. En local: confirmar en el prompt interactivo del CLI
3. Forzar: `proxima deploy {slug} --force`

### `422 — content_page requires path`

Toda página `content_page` necesita `"path": "/..."`.

### `422 — section_type 'X' not declared`

Un `scaffold_sections[].section_type` no está en `section_types[]`.

### Credenciales faltantes

```bash
proxima init {slug}
# o completar PROXIMA_SERVICE_KEY en .env
```

Token: `pxa_test_...` (dev) / `pxa_live_...` (prod).

### Unknown storefront slug

```bash
proxima list
```

---

## Qué pasa con cada tipo de cambio

| Cambio | Resultado |
|--------|-----------|
| Nuevo section type | Creado en la API |
| Nuevo atributo opcional | Añadido al schema |
| Nueva página | Creada y scaffoldeada |
| Mismo manifiesto | unchanged/skipped |
| Cambiar `type` de atributo | **409** (requiere `--force`) |
| Renombrar `name` de atributo | **409** (requiere `--force`) |

El scaffold **nunca sobreescribe** secciones del comercio.

---

## Mantener sync entre código y manifiesto

```
SECTION_REGISTRY["hero_bento"]  ↔  section_types[].key = "hero_bento"
```

---

## CI/CD

```yaml
- name: Deploy section types to Proxima
  run: proxima deploy {slug} --yes
  env:
    PROXIMA_API_URL: ${{ secrets.PROXIMA_API_URL }}
    PROXIMA_DOMAIN: ${{ secrets.PROXIMA_WEBSITE_DOMAIN }}
    PROXIMA_SERVICE_KEY: ${{ secrets.PROXIMA_SERVICE_KEY }}
    CI: "1"
```

Para breaking changes intencionales en CI, añadir `--force`.

Instalar CLI en el job: `npm install -g @proxima-io/cli@0.1.0` o `npx @proxima-io/cli@0.1.0 deploy {slug} --yes`.

Referencia engine: `proxima-storefront-sdk/packages/templateizer/README.md`
