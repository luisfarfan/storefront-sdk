## ADDED Requirements

### Requirement: proxima export fixtures command
The CLI SHALL provide `proxima export fixtures [slug]` that downloads fixture payloads from the Proxima API and writes them to the target storefront app directory.

#### Scenario: Export CMS fixtures to workspace
- **WHEN** the user runs `proxima export fixtures tech-store --scope cms`
- **AND** valid credentials and API export endpoint are available
- **THEN** the CLI writes `proxima.website.json` and CMS fixture files under `apps/tech-store/src/fixtures/`
- **AND** exits with code 0

#### Scenario: Dry run
- **WHEN** the user passes `--dry-run`
- **THEN** the CLI prints planned file changes without modifying the filesystem
- **AND** exits with code 0

#### Scenario: Missing credentials
- **WHEN** `PROXIMA_SERVICE_KEY` is not configured
- **THEN** the CLI exits non-zero with an actionable error message

### Requirement: Workspace resolution matches deploy
The export command SHALL resolve the target app using the same workspace discovery rules as `proxima deploy` / `website-deploy`.

#### Scenario: Slug resolves to app path
- **WHEN** the user passes slug `tech-store`
- **THEN** files are written under `apps/tech-store/` relative to the monorepo root

#### Scenario: CI non-interactive
- **WHEN** multiple workspaces exist and no slug is provided in CI mode
- **THEN** the CLI exits non-zero requiring an explicit slug

### Requirement: Export CLI flags
The command SHALL support:

- `--scope` (`cms` | `catalog` | `all`, default `cms` until catalog API ships, then `all`)
- `--website-domain` (override live domain; default from app `.env` `PROXIMA_WEBSITE_DOMAIN`)
- `--fixture-domain` (domain written into exported `website.json`)
- `--catalog-max-products` (integer, forwarded to API)
- `--dry-run`, `--backup`, `--yes`

#### Scenario: Website domain override
- **WHEN** `--website-domain merchant.example.com` is passed
- **THEN** the API request uses that domain regardless of `.env`

### Requirement: Post-export validation
After writing files (unless `--dry-run`), the CLI SHALL validate the exported fixture set and fail if validation errors exist.

#### Scenario: Full bundle validation
- **WHEN** `scope=all` completes successfully
- **THEN** the CLI runs `validateFixtureBundle` on the written commerce fixtures
- **AND** prints "OK" when the error list is empty

#### Scenario: Validation failure
- **WHEN** validation returns errors
- **THEN** the CLI prints each error and exits with code 1
