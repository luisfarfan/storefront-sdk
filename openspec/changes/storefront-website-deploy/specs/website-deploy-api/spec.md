# Spec: website-deploy-api

## Endpoint

```
POST /api/v1/admin/cms/websites/deploy
```

## Authentication

Bearer token using the website's `PROXIMA_SERVICE_KEY`.
The service key resolves the business. The `website_domain` in the body resolves the
specific website within that business.

## Request Body

```json
{
  "website_domain": "string (required)",
  "section_types": [
    {
      "key": "string (required)",
      "label": "string (required)",
      "category": "string (optional)",
      "attribute_schema": [
        {
          "name": "string (required)",
          "label": "string (optional)",
          "type": "text | rich_text | image | boolean | number | link | object | array | smart_collection_id",
          "config": "object (default: {})",
          "order": "integer (default: 0)",
          "is_required": "boolean (default: false)",
          "localizable": "boolean (default: false)"
        }
      ]
    }
  ],
  "pages": [
    {
      "resolver_kind": "string (required) — content_page | product_detail | category_detail | brand_detail | search | product_list | ...",
      "path": "string (required when resolver_kind='content_page', omit for dynamic types)",
      "label": "string (optional)",
      "scaffold_sections": [
        {
          "section_type": "string — must match a key in section_types",
          "order": "integer (default: 0)"
        }
      ]
    }
  ]
}
```

## Response — 200 OK

```json
{
  "ok": true,
  "website": {
    "id": 7,
    "domain": "tienda-deportes.proxima.app"
  },
  "section_types": {
    "created": ["string"],
    "updated": ["string"],
    "unchanged": ["string"]
  },
  "pages": {
    "created": ["string"],
    "scaffolded": {
      "page_identifier": ["section_type_key"]
    },
    "skipped": {
      "page_identifier": "reason string"
    }
  },
  "warnings": ["string"]
}
```

`page_identifier` is the `path` for static pages and the `resolver_kind` for dynamic templates.

## Response — 409 Conflict (breaking change)

```json
{
  "ok": false,
  "error": "breaking_change",
  "detail": "Attribute 'headline' in section type 'hero' changed type from 'text' to 'rich_text'. Use ?force=true to override.",
  "breaking_changes": [
    {
      "section_type": "hero",
      "attribute": "headline",
      "change": "type_change",
      "from": "text",
      "to": "rich_text"
    }
  ]
}
```

Pass `?force=true` as a query parameter to bypass breaking change protection.

## Response — 404 Not Found

```json
{
  "ok": false,
  "error": "website_not_found",
  "detail": "No website found for domain 'tienda-deportes.proxima.app' in this business"
}
```

## Response — 422 Unprocessable

```json
{
  "ok": false,
  "error": "validation_error",
  "detail": "section_type 'banner' referenced in pages[0].scaffold_sections is not declared in section_types"
}
```

## Idempotency

The endpoint is fully idempotent. Running it multiple times with the same payload
produces the same final state. On subsequent calls with an unchanged manifest,
all section types and pages will appear as `unchanged` / `skipped` in the response.
