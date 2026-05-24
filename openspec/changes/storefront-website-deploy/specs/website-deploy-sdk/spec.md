# Spec: website-deploy-sdk

Changes to `packages/template-schema` and `packages/template-registry-client`.

---

## `packages/template-schema` — new exports

### `WebsiteDeployManifest` type

```typescript
export interface WebsiteDeployManifest {
  schema_version: "1.0";
  section_types: WebsiteDeploySectionType[];
  pages: WebsiteDeployPage[];
}

export interface WebsiteDeploySectionType {
  key: string;
  label: string;
  category?: string;
  attribute_schema: WebsiteDeployAttribute[];
}

export interface WebsiteDeployAttribute {
  name: string;
  label?: string;
  type: AttributeType;  // existing enum
  config: Record<string, unknown>;
  order: number;
  is_required: boolean;
  localizable: boolean;
}

export interface WebsiteDeployPage {
  resolver_kind: string;
  path?: string;          // required when resolver_kind = 'content_page'
  label?: string;
  scaffold_sections: WebsiteDeployScaffoldSection[];
}

export interface WebsiteDeployScaffoldSection {
  section_type: string;  // must match a key in section_types
  order: number;
}
```

### New functions

```typescript
export function parseWebsiteDeployManifest(value: unknown): WebsiteDeployManifest;
// Throws ZodError on invalid input

export function validateWebsiteDeployManifest(
  value: unknown
): z.SafeParseReturnType<WebsiteDeployManifest>;
// Returns { success: true, data } or { success: false, error }
```

### Validation rules enforced by schema

1. Every `section_type` key in any `scaffold_sections` must exist in `section_types`
2. Pages with `resolver_kind === 'content_page'` must have a non-empty `path`
3. `section_types` must have at least 1 entry

---

## `packages/template-registry-client` — new exports

### `WebsiteDeployClient`

```typescript
export interface WebsiteDeployOptions {
  apiUrl?: string;       // default: process.env.PROXIMA_API_URL
  serviceKey?: string;   // default: process.env.PROXIMA_SERVICE_KEY
  fetchImpl?: typeof fetch;
}

export interface WebsiteDeployResult {
  ok: boolean;
  website: {
    id: number;
    domain: string;
  };
  section_types: {
    created: string[];
    updated: string[];
    unchanged: string[];
  };
  pages: {
    created: string[];
    scaffolded: Record<string, string[]>;
    skipped: Record<string, string>;
  };
  warnings: string[];
}

export class WebsiteDeployClientError extends Error {
  readonly status?: number;
  readonly responseText?: string;
  readonly breakingChanges?: Array<{
    section_type: string;
    attribute: string;
    change: string;
    from: string;
    to: string;
  }>;
}

export class WebsiteDeployClient {
  constructor(options?: WebsiteDeployOptions);

  deploy(
    domain: string,
    manifest: WebsiteDeployManifest,
    options?: { force?: boolean }
  ): Promise<WebsiteDeployResult>;
}
```

### Constructor behavior

- Reads `PROXIMA_API_URL` from `process.env` if `apiUrl` not passed. Throws if missing.
- Reads `PROXIMA_SERVICE_KEY` from `process.env` if `serviceKey` not passed. Throws if missing.

### `deploy()` behavior

- Builds body: `{ website_domain: domain, section_types: manifest.section_types, pages: manifest.pages }`
- Appends `?force=true` to URL when `options.force === true`
- Authorization header: `Bearer {serviceKey}`
- On 409: throws `WebsiteDeployClientError` with `status=409` and `breakingChanges` populated
- On 4xx/5xx: throws `WebsiteDeployClientError` with `status` and `responseText`
- On 2xx: returns `WebsiteDeployResult`
