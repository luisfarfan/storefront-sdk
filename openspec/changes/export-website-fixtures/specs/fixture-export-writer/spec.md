## ADDED Requirements

### Requirement: WebsiteExportClient HTTP wrapper
The SDK SHALL expose a typed HTTP client for `GET /api/v1/admin/cms/websites/export` that returns a parsed `WebsiteExportResponse` matching `export_schema_version` supported by the CLI.

#### Scenario: Successful CMS export
- **WHEN** the client calls `export({ websiteDomain: "x.proxima.pe", scope: "cms" })`
- **THEN** it returns an object with `manifest` and `fixtures` properties

#### Scenario: API error propagation
- **WHEN** the API returns 404
- **THEN** the client throws an error with status and message suitable for CLI display

### Requirement: Fixture path convention
The writer SHALL map export payload keys to these relative paths from the app root:

| Payload key | Path |
|-------------|------|
| `manifest` | `proxima.website.json` |
| `fixtures.website` | `src/fixtures/website.json` |
| `fixtures.shell` | `src/fixtures/shell.json` |
| `fixtures.compositions[key]` | `src/fixtures/compositions/{key}.json` |
| `fixtures.catalog_items` | `src/fixtures/catalog-items.json` |
| `fixtures.category_nav_tree` | `src/fixtures/category-nav-tree.json` |
| `fixtures.category_products` | `src/fixtures/category-products.json` |
| `fixtures.cart` | `src/fixtures/cart.json` |

#### Scenario: Composition file naming
- **WHEN** the API returns `fixtures.compositions.home`
- **THEN** the writer creates `src/fixtures/compositions/home.json`

### Requirement: JSON formatting
Written fixture files SHALL be pretty-printed JSON with 2-space indent and a trailing newline.

#### Scenario: Stable formatting
- **WHEN** the same export is written twice without content changes
- **THEN** file bytes are identical (deterministic stringify)
