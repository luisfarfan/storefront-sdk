## 1. `template-schema` — WebsiteDeployManifest schema

- [x] 1.1 Add `websiteDeployAttributeSchema` Zod schema to `packages/template-schema/src/index.ts`
      Fields: `name`, `label`, `type` (enum attributeTypes), `config`, `order`, `is_required`, `localizable`
- [x] 1.2 Add `websiteDeploySectionTypeSchema` Zod schema
      Fields: `key`, `label`, `category`, `attribute_schema`
- [x] 1.3 Add `websiteDeployScaffoldSectionSchema` Zod schema
      Fields: `section_type`, `order`
- [x] 1.4 Add `websiteDeployPageSchema` Zod schema
      Fields: `resolver_kind`, `path` (optional), `label`, `scaffold_sections`
- [x] 1.5 Add `websiteDeployManifestSchema` Zod schema with superRefine validations:
      - All `section_type` keys in `scaffold_sections` must exist in `section_types`
      - `content_page` pages must have a `path`
- [x] 1.6 Export `WebsiteDeployManifest` TypeScript type
- [x] 1.7 Export `parseWebsiteDeployManifest(value: unknown): WebsiteDeployManifest`
- [x] 1.8 Export `validateWebsiteDeployManifest(value: unknown)` returning `SafeParseReturnType`

## 2. `template-registry-client` — WebsiteDeployClient

- [x] 2.1 Add `WebsiteDeployOptions` interface: `apiUrl?`, `serviceKey?`, `fetchImpl?`
- [x] 2.2 Add `WebsiteDeployResult` interface matching the API response shape:
      `ok`, `website: { id, domain }`, `section_types: { created, updated, unchanged }`,
      `pages: { created, scaffolded, skipped }`, `warnings`
- [x] 2.3 Add `WebsiteDeployClientError` class extending Error with `status?`, `responseText?`, `breakingChanges?`
- [x] 2.4 Implement `WebsiteDeployClient` class:
      - Constructor reads `PROXIMA_SERVICE_KEY` from `process.env` if not passed
      - Constructor reads `PROXIMA_API_URL` from `process.env` if `apiUrl` not passed
      - Throws `WebsiteDeployClientError` if credentials missing
- [x] 2.5 Implement `WebsiteDeployClient.deploy(domain, manifest, options?)` method:
      - `POST /api/v1/admin/cms/websites/deploy`
      - Authorization header: `Bearer {serviceKey}`
      - Body: `{ website_domain: domain, section_types: manifest.section_types, pages: manifest.pages }`
      - Appends `?force=true` to URL when `options.force === true`
      - Returns `WebsiteDeployResult` on success
      - Throws `WebsiteDeployClientError` with `breakingChanges` on 409
      - Throws `WebsiteDeployClientError` on other non-2xx responses
- [x] 2.6 Export `WebsiteDeployClient`, `WebsiteDeployOptions`, `WebsiteDeployResult`,
      `WebsiteDeployClientError`, `WebsiteDeployBreakingChange`
      from `packages/template-registry-client/src/index.ts`

## 3. `templateizer` — `website-deploy` command

- [x] 3.1 Add `"website-deploy"` to the `commands` Set in `packages/templateizer/src/index.ts`
- [x] 3.2 Add `findWebsiteManifestPath(targetPath)` helper:
      Looks for `proxima.website.json` in the target directory.
      Falls back to `proxima.template.json` with a deprecation warning.
- [x] 3.3 Add `loadWebsiteManifest(targetPath)` helper:
      Reads and validates `proxima.website.json` using `validateWebsiteDeployManifest`.
      Throws with clear message if not found or schema invalid.
- [x] 3.4 Add `loadDotEnv(targetPath)` and `resolveEnvVar()` helpers for reading `.env` file.
      `process.env` takes precedence over `.env` file values (allows CI overrides).
- [x] 3.5 Add `websiteDeployCommand(targetPath, argv)` async function:
      - Reads `PROXIMA_DOMAIN` from env (or `--domain` flag)
      - Reads `PROXIMA_SERVICE_KEY` from env (or `--service-key` flag)
      - Reads `PROXIMA_API_URL` from env (or `--api-url` flag)
      - Validates credentials before loading manifest
      - Loads and validates manifest (exits 1 with errors on failure)
      - If `--dry-run`: prints the payload as JSON and exits 0
      - Creates `WebsiteDeployClient` and calls `.deploy(domain, manifest, { force })`
      - Prints human-readable diff summary on success
      - Handles 409 (breaking changes), 404, 403 with specific error messages
      - Returns exit code 0 on success, 1 on any error
- [x] 3.6 Wire `website-deploy` command into the `run()` function
- [x] 3.7 Add `website-deploy` entry to `printHelp()` output with its specific flags
- [x] 3.8 Support CLI flags: `--dry-run`, `--force`, `--domain`, `--service-key`, `--api-url`

## 4. `proxima-api` — deploy endpoint (backend)

> ⏳ Pending — backend implementation in `proxima-api` repo (separate repo).
> The SDK side is complete. The backend team implements the endpoint following the
> contract defined in `specs/website-deploy-api/spec.md`.

- [ ] 4.1 Define route: `POST /api/v1/admin/cms/websites/deploy`
      Auth: service key (Bearer token). Resolves business from key.
- [ ] 4.2 Validate request body against the payload schema:
      `website_domain` (required string), `section_types` (array, min 1), `pages` (array)
      Return 422 if any `scaffold_sections` entry references a key not in `section_types`
- [ ] 4.3 Resolve website: find website by `website_domain` within the authenticated business.
      Return 404 if not found. Return 403 if website belongs to a different business.
- [ ] 4.4 Implement section type upsert logic (per-website):
      - For each incoming section type: find existing by `key` in this website
      - If not found: create
      - If found and identical: noop
      - If found and schema differs: apply safe changes; 409 on breaking changes unless `?force=true`
      - Collect created/updated/unchanged into response object
- [ ] 4.5 Implement breaking-change detection:
      - `type` change on existing attribute → 409
      - `name` change on existing attribute → 409
      - Both suppressed when `?force=true`
- [ ] 4.6 Implement page upsert logic (per-website):
      - For each incoming page: find existing by `path` (static) or `resolver_kind` (dynamic)
      - If not found: create page
      - If found: check if it has sections
        - No sections → scaffold
        - Has sections → skip (add to `skipped` in response)
- [ ] 4.7 Implement `scaffold_sections` creation:
      For each entry in `scaffold_sections`, create an empty section of that type
      with the given `order`. No content/attribute values are set.
- [ ] 4.8 Collect and return warnings:
      - New `is_required` attribute added to an existing section type → warn with count of affected sections
      - Section type exists in the website but absent from the manifest → warn (potential orphan)
- [ ] 4.9 Return `WebsiteDeployResult` JSON on success (200)
- [ ] 4.10 Write integration tests for the endpoint covering:
      - Fresh deploy (no existing data)
      - Re-deploy idempotency (identical manifest)
      - Additive attribute change
      - Breaking attribute change → 409
      - Breaking attribute change with `?force=true` → 200
      - Page with existing merchant sections → skipped
      - Invalid `website_domain` → 404
      - Wrong business → 403

## 5. `storefront-starter` — manifest files

- [x] 5.1 Create `examples/storefront-starter/proxima.website.json` with the correct
      `WebsiteDeployManifest` schema (schema_version, section_types, pages)
      covering all 6 sections: header, hero, product_grid, category_grid, search, footer
- [x] 5.2 Update `examples/storefront-starter/proxima.template.json` to match the real
      `TemplateManifest` schema from `template-schema` (template_key, slug, name, renderer, etc.)
- [x] 5.3 Update `examples/storefront-starter/README.md` to document both files and their purposes

## 6. Docs update

- [x] 6.1 Update `docs/09-deploy.md`:
      - Changed manifest file reference to `proxima.website.json`
      - Changed CLI command to `templateizer website-deploy`
      - Clarified `PROXIMA_SERVICE_KEY` (not `PROXIMA_API_TOKEN`)
      - Added section explaining the difference between both manifest files
      - Added `--dry-run`, `--force`, `--domain`, `--service-key` flags
