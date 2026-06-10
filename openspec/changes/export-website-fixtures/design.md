## Context

`templateizer website-deploy` ya:

- Resuelve workspace monorepo
- Lee `.env` / `.proxima/credentials.json`
- POST manifest → API

Export replica el wiring de credenciales y paths, invirtiendo dirección de datos.

Fixture layout canónico (golden: tech-store, legacy: 214store):

```
apps/{slug}/
├── proxima.website.json
└── src/fixtures/
    ├── website.json
    ├── shell.json
    ├── compositions/{key}.json
    ├── catalog-items.json      # phase 2
    ├── category-nav-tree.json
    ├── category-products.json
    └── cart.json
```

## Goals / Non-Goals

**Goals:**

- Un comando escribe export API → disco con paths predecibles
- `--dry-run` imprime diff/plan sin escribir
- Post-write validation via `validateFixtureBundle` from `@proxima-io/storefront-core`
- CI-friendly: `--yes` / non-interactive cuando domain explícito

**Non-Goals:**

- Resolver conflictos git
- Merge inteligente field-by-field (overwrite file-level v1)
- Export desde fixtures mode sin API

## CLI UX

```bash
# Phase 1 — CMS only
proxima export fixtures tech-store --scope cms

# Phase 2 — full demo bundle
proxima export fixtures tech-store --scope all --catalog-max-products 24

# Preview
proxima export fixtures tech-store --dry-run

# Override live domain (merchant production host)
proxima export fixtures tech-store --website-domain tienda.cliente.pe

# Fixture domain written to website.json
proxima export fixtures tech-store --fixture-domain tech-store.localhost
```

**Output ejemplo:**

```
Exporting CMS fixtures for tech-store.proxima.pe → apps/tech-store/
  ✓ proxima.website.json (12 section types, 18 pages)
  ✓ src/fixtures/website.json
  ✓ src/fixtures/shell.json
  ✓ src/fixtures/compositions/ (18 files)
Validating fixture bundle… OK
```

## Decisions

### D1: Subcomando bajo `proxima export`, no templateizer interno

`export` es top-level en CLI (`proxima export fixtures`) para discoverability. Implementation puede delegar a templateizer module `export-fixtures`.

### D2: File write strategy v1 — overwrite

Cada archivo exportado reemplaza el anterior completo. `--dry-run` lista `[update]`, `[create]`, `[unchanged]` por hash.

Futuro: `--merge manifest` para no pisar `scaffold_sections` locales.

### D3: Composition filenames

`compositions/{key}.json` donde `key` viene del API (`meta.composition_keys`) — single source of truth.

### D4: Validation hook

Después de write:

```ts
import { validateFixtureBundle, createFixtureBundle } from "@proxima-io/storefront-core/fixtures-commerce";
const errors = validateFixtureBundle(createFixtureBundle({ catalog, categoryNavTree, cart, categoryProductMap }));
```

Si `--scope cms`, validar solo CMS files existentes (skip catalog rules) o usar `validateFixtureBundle` parcial — implementar `validateCmsFixtures()` helper si necesario.

### D5: Credentials

Misma resolución que deploy: `CLI flags > env > .proxima/credentials.json > .env`.

Required: `PROXIMA_API_URL`, `PROXIMA_SERVICE_KEY`, `website_domain` (env `PROXIMA_WEBSITE_DOMAIN` or flag).

### D6: npm script en apps

Golden template añade:

```json
"fixtures:export": "proxima export fixtures"
```

(slug inferido del package name / cwd)

## Package layout

```
packages/template-registry-client/src/website-export.ts   # HTTP client
packages/templateizer/src/export-fixtures.ts              # orchestration + writer
packages/cli/src/index.ts                                 # register export command
```

## Risks

- **[Risk] validateFixtureBundle fails after CMS-only export** — scope-aware validation
- **[Risk] Large composition count** — progress spinner + count in summary

## Open Questions

- ¿Backup `.fixtures.bak/` antes de overwrite? **Opcional `--backup` flag v1.**
