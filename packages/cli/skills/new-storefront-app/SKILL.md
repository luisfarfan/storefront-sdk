---
name: new-storefront-app
description: Scaffold a new storefront website app in the proxima-storefronts monorepo. Copies apps/214store as template (golden Proxima storefront), wires buyer commerce routes, proxima.website.json, and registers the app in package.json and Caddyfile. Use when a new brand/website needs its own independent Astro SSR app.
license: MIT
---

Scaffold a new independent storefront website app in the `apps/` directory of this monorepo.

## What I'll do

1. Ask for the required inputs (if not provided as arguments)
2. Create `apps/{slug}/` by copying the **214store** template structure
3. Customize `package.json`, `astro.config.mjs`, `.env`, `.env.example` for the new app
4. Register the dev script in the root `package.json`
5. Add a reverse-proxy entry to `Caddyfile`
6. Run `npm install` to link workspace dependencies

Analytics is wired in the golden template via **SSR config + cookie consent + beacons** (SDK `docs/13-analytics.md`; storefront reference `apps/tech-store/docs/analytics.md`). Live merchant sites only.

The following commerce features are included out of the box (copied from 214store):

- **PLP with filters**: `ProductListingPage.astro` (`product_listing` section type) — filters by brand, price, stock with desktop sidebar + mobile drawer. Reads active filter state from `Astro.url.searchParams` (`?brand=X&price_min=Y&sort=Z`). CMS controls which filter groups are visible via `show_brand_filter`, `show_price_filter`, `show_stock_filter` booleans in `attribute_schema`.

- **Guest checkout**: `CheckoutView.astro` allows purchases without login by default. To require login for a specific storefront, set `guest_checkout: false` in the website's capabilities object in the admin. The API route is `src/pages/api/buyer/guest-order.ts` which calls `processGuestCheckout()` from the SDK with the cart session cookie (`pxa_cart_session`). See CLAUDE.md → "Arquitectura de Guest Checkout" for the full flow.

- **Scaffold default values**: `proxima.website.json` (copied from 214store) includes `default_values` in all `scaffold_sections`. When `proxima deploy {slug}` runs for the first time on a fresh website (no existing merchant sections), the API applies these defaults automatically — headings, CTAs, sort settings, and references to smart collections (`"auto:featured_products"`, `"auto:latest_products"`, etc.). Requires the Proxima API's auto-collection feature (change B) to resolve the `auto:` slugs into actual collections. If change B is not yet active, text defaults still apply and catalog sections simply show their Builder empty states.

- **Builder empty states**: The 4 catalog components (`ProductGrid`, `HeroBento`, `CategoryGrid`, `BrandsDirectory`) show a visual placeholder in Builder mode (`cmsPreview === true`) when their smart collection is not configured. The placeholder includes a dashed border, a neutral icon, and an instruction pointing to the Builder. In live mode (`cmsPreview === false`), these components continue to return `null` when there's no data — no broken UI visible to end customers.

## Inputs

Parse from the skill argument string if provided (e.g. `/new-storefront-app my-shop myshop.localhost 4325`).
Otherwise ask using **AskUserQuestion** (one question with all fields):

- **slug** — kebab-case app name, also used as directory name (e.g. `my-shop`)
- **domain** — local development domain, must end in `.localhost` (e.g. `myshop.localhost`)
- **port** — dev server port, must not conflict (devhub: 4320, tienda-214: 4324, 214store: 4325; usar el siguiente libre)
- **display name** — human-readable name for package.json (e.g. `My Shop`)

## Steps

### 1. Validate inputs

- `slug` must match `/^[a-z][a-z0-9-]+$/`
- `domain` must end in `.localhost`
- `port` must be a number 1024–65535 and not already used (check existing `astro.config.mjs` files under `apps/`)
- `apps/{slug}/` must not already exist

Abort with a clear error message if any validation fails.

### 2. Copy 214store as template

```bash
cp -r apps/214store apps/{slug}
```

Then clean up build artifacts:
```bash
rm -rf apps/{slug}/dist apps/{slug}/.astro apps/{slug}/node_modules
```

**Fixture set (copied from 214store):** each new app keeps its own `src/fixtures/` JSON. After copy, customize catalog/shell for the brand. Required commerce fixtures:

| File | Notes |
|------|-------|
| `catalog-items.json` | Product entities; slugs must match composition references |
| `category-nav-tree.json` | Run `node scripts/build-category-nav-tree-fixture.mjs` after editing `shell.json` |
| `cart.json` | Guest cart preview (read-only in fixtures mode) |
| `category-products.json` | Optional category → product slug map |
| `src/lib/storefront-data.ts` | Wires JSON → SDK `createFixtureBundle` / `createStorefrontDataSource` |

Add to `package.json` scripts:
```json
"fixtures:validate": "node scripts/validate-fixtures.mjs"
```

Copy `scripts/validate-fixtures.mjs` and `scripts/build-category-nav-tree-fixture.mjs` from 214store.

### 3. Update `apps/{slug}/package.json`

Replace:
- `"name": "@proxima-io/214store"` → `"name": "@proxima-io/{slug}"`
- `"dev": "astro dev --port 4321"` → `"dev": "astro dev --port {port}"`
- `"preview": "astro preview --port 4321"` → `"preview": "astro preview --port {port}"`

No copiar scripts `manifest:*` / `template:*` — el CLI global `proxima` los reemplaza. Mantener solo `dev`, `build`, `preview`, `test`, y scripts de fixtures si aplican.

### 4. Update `apps/{slug}/.env`

Create the file with:
```
PROXIMA_API_URL=http://localhost:8000
PROXIMA_WEBSITE_DOMAIN={domain}
PROXIMA_DOMAIN={domain}
# PROXIMA_SERVICE_KEY=
# PROXIMA_DATA_MODE=fixtures
```

Also create `apps/{slug}/.env.example` with the same content (without values).

### 5. Create/update `apps/{slug}/.env.example`

```
PROXIMA_API_URL=http://localhost:8000
PROXIMA_WEBSITE_DOMAIN=
PROXIMA_SERVICE_KEY=
```

### 6. Update root `package.json`

Add to `scripts`:
```json
"dev:{slug}": "npm --workspace @proxima-io/{slug} run dev"
```

Also update the `"dev"` script to include `dev:{slug}` in the `concurrently` call.

Verificar que la raíz tenga `@proxima-io/cli` en `devDependencies` (ya incluido en este monorepo) para `npm run proxima -- list`.

### 7. Update `Caddyfile`

Append before the catch-all block (if present):

```
http://{domain} {
  reverse_proxy localhost:{port}
}
```

Luego verificar: `proxima caddy check` (desde la raíz del monorepo).

### 8. Install agent skills in the new app

From the new app directory (or monorepo root with slug):

```bash
cd apps/{slug}
proxima skills install website-deploy add-section wire-cms-sections
```

This copies skills into `.cursor/skills/` and `.claude/skills/` from `@proxima-io/cli` — no manual copy from the monorepo.

Also create `apps/{slug}/CLAUDE.md` with project context (copy from `apps/214store/CLAUDE.md` if it exists, or root `CLAUDE.md` trimmed to this app).

Limpiar referencias al tenant 214store en `proxima.website.json`, fixtures y `PROXIMA_*` — el nuevo slug debe tener su propio manifiesto y dominio.

### 9. Run `npm install`

```bash
npm install
```

This registers the new workspace package.

## Output

On success, print:
```
✅ New storefront app created: {display name}

  App directory:  apps/{slug}/
  Package name:   @proxima-io/{slug}
  Dev domain:     http://{domain}:{port}
  Caddy entry:    {domain} → localhost:{port}

Next steps:
  1. npm run dev:{slug}          — start the dev server
  2. proxima list                — confirm the new app appears
  3. Create a website in the CMS with domain: {domain} (o script de seed en proxima-api)
  4. Customize src/components/   — adapt sections and styles for this brand
  5. Edit proxima.website.json (keys, attribute_schema) — doc 07-cms-attribute-schema.md
  6. proxima init {slug}         — wizard → .proxima/credentials.json
  7. proxima deploy {slug}       — sync schemas a la API (CI: proxima deploy {slug} --yes)
  8. proxima caddy check         — verify Caddy routes
  9. (Optional) npm run dev      — start all apps together

Analytics (live only): SSR config JSON + cookie consent + beacons. See SDK `docs/13-analytics.md`.
  Endpoint: POST /api/v1/storefront/events (X-Business-ID + X-Session-ID).
```

## Analytics tracking

SDK contract: **`docs/13-analytics.md`**. Storefront wiring reference: **`proxima-storefronts/apps/tech-store/docs/analytics.md`**.

| Layer | What |
|-------|------|
| SSR config | `#pxa-analytics-config` — pass `sessionId` from cart cookie |
| Consent | `analytics.init(config, { requireAnalyticsConsent: true })` |
| Beacons | SSR `data-pxa-beacon` for page-level events |
| Store | Cart mutations only — no scattered `track()` in buttons |

Transport: `POST /api/v1/storefront/events`. UTMs auto-merge into `payload.attribution`.

## Guardrails

- Never overwrite an existing `apps/{slug}/` directory
- Never reuse a port already in use by another app
- Always show the output summary so the developer knows what was created
- If `npm install` fails, explain why but do NOT roll back the created files — the developer can fix and re-run
- The API routes in `src/pages/api/buyer/` are thin delegates to `storefront-core` handlers — do not replace them with inline logic
- The `.env` file with `PROXIMA_WEBSITE_DOMAIN` is what makes this app single-tenant — remind the developer they need to create the corresponding website in the CMS
- Analytics fires automatically once `SiteLayout.astro` is rendered with a valid `website` prop — no extra configuration needed beyond the standard CMS website setup
