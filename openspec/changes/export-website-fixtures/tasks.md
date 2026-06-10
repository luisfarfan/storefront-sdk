## 0. Prerequisites

- [x] 0.1 API phase 1 endpoint implemented
- [x] 0.2 `WebsiteExportResponse` schema aligned with API

## 1. HTTP client

- [x] 1.1 `WebsiteExportClient.export({ websiteDomain, scope, fixtureDomain, ... })`
- [x] 1.2 Types `WebsiteExportResponse`, `WebsiteExportFixtures`, `WebsiteExportMeta`
- [x] 1.3 Error mapping 404/403/422 → CLI messages

## 2. Fixture writer

- [x] 2.1 `resolveFixturePaths(appRoot)` — returns map of logical keys → absolute paths
- [x] 2.2 `writeFixtureExport(appRoot, response, { dryRun })`
- [x] 2.3 Write `proxima.website.json` (formatted JSON, trailing newline)
- [x] 2.4 Write `src/fixtures/website.json`, `shell.json`
- [x] 2.5 Write `src/fixtures/compositions/{key}.json` for each key
- [ ] 2.6 Phase 2: write commerce JSON files
- [x] 2.7 `--dry-run` mode: plan summary without writes

## 3. Validation integration

- [x] 3.1 Post-write: CMS export structural validation
- [x] 3.2 `scope=cms`: CMS-only validation
- [ ] 3.3 `scope=all`: full `validateFixtureBundle`
- [x] 3.4 Exit code 1 on validation errors with printed list

## 4. CLI command

- [x] 4.1 Register `proxima export fixtures [slug]` in `packages/cli/src/index.ts`
- [x] 4.2 Flags: `--scope`, `--website-domain`, `--fixture-domain`, `--dry-run`, `--yes`
- [x] 4.3 Workspace resolution re-use from deploy
- [x] 4.4 Help text in templateizer + cli help

## 5. Tests

- [x] 5.1 Unit: writer creates expected file tree from fixture response JSON
- [x] 5.2 Unit: dry-run does not touch filesystem
- [ ] 5.3 Unit: validation failure surfaces errors
- [ ] 5.4 Integration: mock API → temp dir → validate passes (golden snapshot)

## 6. Docs

- [x] 6.1 CLI help — inverse of website-deploy
- [x] 6.2 Cross-link proxima-storefronts DATA.md
