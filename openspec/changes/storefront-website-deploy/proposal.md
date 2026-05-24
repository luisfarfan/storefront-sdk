## Why

When a developer builds a Proxima storefront for a specific client, they need a way to
push their storefront's structure (section types + page scaffolding) to the Proxima API
so that the merchant can immediately start editing content via the Builder.

Currently, there is no endpoint or tooling for this. The templateizer CLI handles the
**template marketplace** flow (register/publish a template for N merchants), but there is
no equivalent for the **website deployment** flow (push to one specific website).

Without this, the developer must manually create every section type and page through the
admin UI — which is error-prone, time-consuming, and not repeatable.

## What Changes

- **New API endpoint** in `proxima-api`: `POST /api/v1/admin/cms/websites/deploy`
  Authenticated via service key. Receives section types + pages, registers/upserts
  section types, creates missing pages, and scaffolds sections on empty pages.
  Returns a detailed diff summary. Never overwrites merchant content.

- **New manifest schema** in `packages/template-schema`: `WebsiteDeployManifest` —
  a simpler Zod schema for the website deploy use case, without marketplace fields.
  Exported alongside the existing `TemplateManifest`.

- **New `proxima.website.json` manifest file** in `examples/storefront-starter`:
  The developer defines their section types and pages here. Separate from
  `proxima.template.json` (which is for the marketplace template flow).

- **New `WebsiteDeployClient`** in `packages/template-registry-client`:
  HTTP client class that calls the new deploy endpoint. Uses `PROXIMA_SERVICE_KEY`
  (not `PROXIMA_API_TOKEN`) since the developer already has this credential.

- **New `website-deploy` command** in `packages/templateizer`:
  `templateizer website-deploy` reads `proxima.website.json` + `.env`, validates
  locally, and calls `WebsiteDeployClient`. Prints a structured diff summary.
  Supports `--dry-run` and `--force` flags.

- **Updated `docs/09-deploy.md`**: Corrected to reflect the actual CLI command,
  manifest file name, and credential requirements.

## Capabilities

### New Capabilities

- `website-deploy-api`: New API endpoint `POST /api/v1/admin/cms/websites/deploy`
  in `proxima-api`. Handles upsert of section types, page creation, and section
  scaffolding for a specific website. Fully idempotent.

- `website-deploy-manifest-schema`: New `WebsiteDeployManifest` Zod schema and
  `parseWebsiteDeployManifest` / `validateWebsiteDeployManifest` helpers in
  `packages/template-schema`. Validates `proxima.website.json`.

- `website-deploy-client`: New `WebsiteDeployClient` class in
  `packages/template-registry-client`. Exposes `deploy(domain, manifest)` method.

- `website-deploy-cli`: New `website-deploy` command in `packages/templateizer`.
  Reads `.env` + `proxima.website.json`, calls `WebsiteDeployClient`, prints output.

- `storefront-starter-manifest`: New `proxima.website.json` in
  `examples/storefront-starter` with the correct schema for the starter's sections
  and pages. Replaces the incorrect `proxima.template.json` created earlier.

### Modified Capabilities

- `template-registry-client-package`: `WebsiteDeployClient` class added. Existing
  `TemplateRegistryClient` is unchanged.

- `template-schema-package`: `WebsiteDeployManifest` schema added. Existing
  `TemplateManifest` schema is unchanged.

- `templateizer-cli-package`: `website-deploy` command added to the command set.
  Existing commands unchanged.

## Impact

- `proxima-api` (separate repo): new endpoint + handler + service layer for website deploy
- `packages/template-schema/src/index.ts`: new `WebsiteDeployManifest` schema exported
- `packages/template-registry-client/src/index.ts`: new `WebsiteDeployClient` class exported
- `packages/templateizer/src/index.ts`: new `website-deploy` command registered
- `examples/storefront-starter/proxima.website.json`: new file (correct manifest)
- `examples/storefront-starter/proxima.template.json`: kept for marketplace flow (corrected schema)
- `docs/09-deploy.md`: updated to reflect correct command and manifest file

No breaking changes. All existing templateizer commands, template-schema exports, and
template-registry-client exports are unchanged.
