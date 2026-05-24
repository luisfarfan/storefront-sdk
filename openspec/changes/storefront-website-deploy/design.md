## Context

A Proxima storefront is an Astro SSR app that renders sections defined in the Proxima
Builder. Each section has a `type` that maps to an Astro component, and each type has
an `attribute_schema` that tells the Builder what fields to show when the merchant edits
that section.

When a developer builds a storefront for a specific client, they:
1. Implement Astro components for each section type
2. Define the attribute schemas for each section type
3. Define which pages the website has and which sections should appear on each by default

Currently, there is no automated way to push steps 2 and 3 to the Proxima API. The
developer must create section types and pages manually in the admin UI.

The existing `templateizer` CLI and `template-registry-client` package handle the
**template marketplace** flow — registering a reusable template for many merchants.
That flow uses `PROXIMA_API_TOKEN` (an admin token for template management) and targets
`/api/v1/admin/cms/website-templates`.

The **website deploy** flow is fundamentally different:
- Target: one specific website (identified by domain)
- Auth: `PROXIMA_SERVICE_KEY` (the developer already has this for the storefront)
- Operation: register section types + scaffold pages for that website only
- Idempotent: safe to re-run on every iteration

## Goals / Non-Goals

**Goals:**
- Define a new API endpoint `POST /api/v1/admin/cms/websites/deploy` in `proxima-api`.
- Define a minimal `WebsiteDeployManifest` schema (section types + pages only).
- Implement `WebsiteDeployClient` in `template-registry-client`.
- Implement `templateizer website-deploy` command.
- Add `proxima.website.json` to the storefront starter with the correct schema.
- The operation must be fully idempotent — safe to run repeatedly.
- Never destroy or overwrite merchant content.

**Non-Goals:**
- No changes to the template marketplace flow (`register`, `publish`, `sync` commands).
- No creation of the website itself — the website must already exist in the admin.
- No theme or design token management — handled separately in Astro code.
- No website variants management — variants are created by the merchant, not the developer.
- No deletion of section types or pages — deploy is additive only.
- No content seeding with actual values — sections are scaffolded empty.

## The API Endpoint

### Request

```
POST /api/v1/admin/cms/websites/deploy
Authorization: Bearer {PROXIMA_SERVICE_KEY}
Content-Type: application/json
```

```json
{
  "website_domain": "tienda-deportes.proxima.app",
  "section_types": [
    {
      "key": "hero",
      "label": "Hero Principal",
      "category": "content",
      "attribute_schema": [
        { "name": "image",    "label": "Imagen",   "type": "image", "is_required": true, "order": 1 },
        { "name": "headline", "label": "Título",   "type": "text",  "localizable": true,  "order": 2 },
        { "name": "cta",      "label": "Botón CTA","type": "link",                        "order": 3 }
      ]
    }
  ],
  "pages": [
    {
      "resolver_kind": "content_page",
      "path": "/",
      "label": "Home",
      "scaffold_sections": [
        { "section_type": "header", "order": 1 },
        { "section_type": "hero",   "order": 2 },
        { "section_type": "footer", "order": 99 }
      ]
    },
    {
      "resolver_kind": "product_detail",
      "label": "Detalle de Producto",
      "scaffold_sections": [
        { "section_type": "header", "order": 1 },
        { "section_type": "footer", "order": 99 }
      ]
    }
  ]
}
```

**Notes on the pages array:**
- Static pages have both `resolver_kind: "content_page"` and a `path` field.
- Dynamic page templates (product_detail, category_detail, etc.) have only `resolver_kind`
  and no `path`. They apply to all URLs of that type resolved by the composition engine.
- `scaffold_sections` references section types by `key`. All referenced keys must exist
  in the `section_types` array of the same payload. The API validates this.

### Response — 200 OK

```json
{
  "ok": true,
  "website": {
    "id": 7,
    "domain": "tienda-deportes.proxima.app"
  },
  "section_types": {
    "created": ["category_grid", "search"],
    "updated": ["hero"],
    "unchanged": ["header", "product_grid", "footer"]
  },
  "pages": {
    "created": ["/"],
    "scaffolded": {
      "/": ["header", "hero", "product_grid", "footer"]
    },
    "skipped": {
      "product_detail": "page template already has sections"
    }
  },
  "warnings": [
    "Attribute 'columns' added with is_required=true to 'product_grid' — 3 existing sections have no value for this field"
  ]
}
```

### Error responses

| Status | When |
|--------|------|
| 401 | Missing or invalid service key |
| 403 | Service key does not belong to the business that owns this website |
| 404 | No website found for `website_domain` |
| 422 | Validation error — e.g., `scaffold_sections` references a key not in `section_types` |
| 409 | Breaking change detected (attribute type change, attribute rename) — use `?force=true` to override |

### Idempotency rules (server-side)

**Section types:**
| Situation | Behavior |
|-----------|----------|
| Key is new | Create |
| Key exists, schema identical | Noop |
| New optional attribute | Add to schema |
| New required attribute | Add + emit warning |
| Changed label/order | Update |
| Changed `localizable` flag | Update |
| Changed attribute `type` | 409 unless `?force=true` |
| Renamed attribute (`name`) | 409 unless `?force=true` — treated as delete+create |
| Attribute removed from schema | Add warning in response, keep existing data |

**Pages:**
| Situation | Behavior |
|-----------|----------|
| Static page (by `path`), doesn't exist | Create + scaffold |
| Dynamic template (by `resolver_kind`), doesn't exist | Create template + scaffold |
| Page exists, has no sections | Scaffold |
| Page exists, has sections | Skip scaffold entirely — never modify merchant content |

## The Manifest Schema (`proxima.website.json`)

Separate from `proxima.template.json` (marketplace). Simpler — no marketplace fields.

```typescript
// packages/template-schema/src/index.ts — additions

export const websiteDeployAttributeSchema = z.object({
  name:          z.string().min(1),
  label:         z.string().optional(),
  type:          z.enum(attributeTypes),
  config:        jsonObject.default({}),
  order:         z.number().int().default(0),
  is_required:   z.boolean().default(false),
  localizable:   z.boolean().default(false),
});

export const websiteDeploySectionTypeSchema = z.object({
  key:              z.string().min(1),
  label:            z.string().min(1),
  category:         z.string().optional(),
  attribute_schema: z.array(websiteDeployAttributeSchema).default([]),
});

export const websiteDeployScaffoldSectionSchema = z.object({
  section_type: z.string().min(1),
  order:        z.number().int().default(0),
});

export const websiteDeployPageSchema = z.object({
  resolver_kind:     z.string().min(1),
  path:              z.string().optional(),   // required for content_page, omit for dynamic types
  label:             z.string().optional(),
  scaffold_sections: z.array(websiteDeployScaffoldSectionSchema).default([]),
});

export const websiteDeployManifestSchema = z
  .object({
    schema_version: z.literal("1.0").default("1.0"),
    section_types:  z.array(websiteDeploySectionTypeSchema).min(1),
    pages:          z.array(websiteDeployPageSchema).default([]),
  })
  .superRefine((manifest, ctx) => {
    // All section_type keys in scaffold_sections must be declared in section_types
    const keys = new Set(manifest.section_types.map(st => st.key));
    manifest.pages.forEach((page, pi) => {
      page.scaffold_sections.forEach((section, si) => {
        if (!keys.has(section.section_type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `section_type '${section.section_type}' not declared in section_types`,
            path: ['pages', pi, 'scaffold_sections', si, 'section_type'],
          });
        }
      });
    });
    // content_page must have a path
    manifest.pages.forEach((page, pi) => {
      if (page.resolver_kind === 'content_page' && !page.path) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `pages with resolver_kind 'content_page' require a 'path' field`,
          path: ['pages', pi, 'path'],
        });
      }
    });
  });

export type WebsiteDeployManifest = z.infer<typeof websiteDeployManifestSchema>;
export function parseWebsiteDeployManifest(value: unknown): WebsiteDeployManifest { ... }
export function validateWebsiteDeployManifest(value: unknown) { ... }
```

## The `WebsiteDeployClient`

```typescript
// packages/template-registry-client/src/index.ts — additions

export interface WebsiteDeployOptions {
  apiUrl?: string;
  serviceKey?: string;    // reads PROXIMA_SERVICE_KEY from env
  fetchImpl?: typeof fetch;
}

export interface WebsiteDeployResult {
  ok: boolean;
  website: { id: number; domain: string };
  section_types: { created: string[]; updated: string[]; unchanged: string[] };
  pages: { created: string[]; scaffolded: Record<string, string[]>; skipped: Record<string, string> };
  warnings: string[];
}

export class WebsiteDeployClient {
  constructor(options?: WebsiteDeployOptions);
  deploy(domain: string, manifest: WebsiteDeployManifest, options?: { force?: boolean }): Promise<WebsiteDeployResult>;
}
```

## The `templateizer website-deploy` command

```bash
# Basic deploy — reads .env + proxima.website.json from current directory
templateizer website-deploy

# Dry run — prints what would happen without calling the API
templateizer website-deploy --dry-run

# Force breaking changes (attribute type changes, renames)
templateizer website-deploy --force

# Override credentials/URL (useful in CI)
templateizer website-deploy --api-url https://api.proxima.io --service-key sk_live_...
```

**CLI output format (human-readable):**
```
✓ Connected to tienda-deportes.proxima.app (website #7)

Section types
  + created    category_grid
  + created    search
  ~ updated    hero  (headline: localizable enabled)
  · unchanged  header, product_grid, footer

Pages
  + created    /  →  scaffolded [header, hero, product_grid, category_grid, footer]
  + created    product_detail  →  scaffolded [header, footer]
  · skipped    search  (has merchant sections — not modified)

⚠ Warnings
  · Attribute 'columns' added with is_required=true to 'product_grid'
    3 existing sections have no value for this field

✓ Deploy completed in 1.4s
```

**Credential resolution order (service key):**
1. `--service-key` CLI flag
2. `PROXIMA_SERVICE_KEY` env var (from `.env` in project root)
3. Error: "PROXIMA_SERVICE_KEY is required"

**`website_domain` resolution order:**
1. `--domain` CLI flag
2. `PROXIMA_DOMAIN` env var (from `.env`)
3. Error: "PROXIMA_DOMAIN is required"

## Decisions

### Use `PROXIMA_SERVICE_KEY` not `PROXIMA_API_TOKEN`

The developer has `PROXIMA_SERVICE_KEY` because they need it to run the storefront.
Using the same key for deploy avoids introducing a second credential type for the
same person. The service key already identifies the business; the `website_domain`
in the payload identifies which website within that business.

Alternative: require `PROXIMA_API_TOKEN` (same as template marketplace). Rejected
because it's a second credential the developer would have to manage separately, with
no benefit.

### Separate `proxima.website.json` from `proxima.template.json`

The two files serve different purposes:
- `proxima.website.json` → deploy to a specific client website (required fields: `section_types`, `pages`)
- `proxima.template.json` → publish to the template marketplace (required: `template_key`, `slug`, `renderer`, etc.)

A developer building for a client only needs the first. A developer building a
reusable template only needs the second. A developer doing both can maintain both files.

Alternative: merge into one file with optional fields. Rejected because it creates
confusion about which fields are required for which operation, and the schema
validation becomes harder to reason about.

### `scaffold_sections` is additive and one-time only

When a page is created for the first time, `scaffold_sections` defines the initial
structure. If the page already has sections (created by the merchant via the Builder),
the scaffold is skipped entirely — even if the developer changed `scaffold_sections`
in the manifest.

Alternative: always re-sync sections on deploy. Rejected because it would destroy
merchant content on re-deploy. The developer's job is to set up the initial structure;
after that, the merchant owns the content.

### 409 for breaking changes, not silent skip

When the developer changes an attribute's type or renames it, the server returns 409
rather than silently skipping. The developer must explicitly pass `--force` to proceed.

Alternative: warn and skip. Rejected because the developer might not notice the skip
and ship code that references the new attribute name while the API still has the old one.
An explicit error forces a conscious decision.

### Dynamic page templates have no `path`

`product_detail`, `category_detail`, etc. are not tied to a single URL — they apply to
all URLs resolved with that `resolver_kind`. So the manifest and the API both identify
them by `resolver_kind` only, without a `path`.

Static pages (`content_page`) always have a `path`. The schema validates this.

## Risks / Trade-offs

- **Service key scope** — Using the service key for deploy operations means the developer's
  storefront credentials also have write access to section types and pages. If the service
  key is compromised, an attacker could modify the website structure. Mitigation: service
  keys should be rotated regularly and stored in `.env` (not committed to git).

- **No automatic section type deletion** — If the developer removes a section type from
  the manifest and re-deploys, the API will not delete the section type. The merchant
  might still have sections of that type in their pages. Manual cleanup via the admin UI
  is required. Mitigation: the CLI will emit a warning if it detects section types that
  exist in the API but are absent from the manifest.

- **Scaffold drift** — The merchant may add/remove sections from a page after deploy,
  diverging from the manifest's `scaffold_sections`. This is intentional — the manifest
  is the initial state, not a desired state. No sync enforcement.

- **`content_page` paths are fixed strings** — If the developer changes a static page's
  path in the manifest (e.g., `/about` → `/nosotros`), the old page is not renamed or
  deleted. A new page at the new path is created. The developer must archive the old page
  manually. Mitigation: the CLI warns when a `content_page` path in the manifest does not
  match any existing page.

## Migration Plan

1. Add `WebsiteDeployManifest` schema to `packages/template-schema` (additive, no breaking changes).
2. Add `WebsiteDeployClient` to `packages/template-registry-client` (additive).
3. Add `website-deploy` command to `packages/templateizer` (additive to existing command set).
4. Backend team implements `POST /api/v1/admin/cms/websites/deploy` in `proxima-api`.
5. Add `proxima.website.json` to `examples/storefront-starter`.
6. Update `docs/09-deploy.md` to reflect the new command and manifest file.

Steps 1–3 and 5–6 can be done in the SDK monorepo in parallel with step 4 (backend).
The `--dry-run` flag allows the CLI to be tested before the backend endpoint is live.
