# @proxima-io/cli

## 0.3.1

### Patch Changes

- `proxima deploy --auto-scaffold` for smart collection auto-scaffold during website deploy.
- Updated dependencies
  - @proxima-io/templateizer@0.2.2

## 0.3.0

### Minor Changes

- 40e730d: Three new bundled agent skills, installable via `proxima skills install`:

  - **add-page** — add a new page to a storefront (prerender rules, resolver_kind
    mapping, manifest declaration, deploy). Includes the `[slug]` → `prerender=false`
    gotcha for merchant-catalog routes.
  - **add-smart-collection** — add a dynamic catalog collection (product rail,
    category grid, brand strip). Covers the 3 creation methods (manifest placeholder,
    auto-scaffold, manual Admin) and runtime envelope consumption.
  - **debug-storefront** — triage storefront bugs with a symptom → verify → root
    cause → fix flow. 10 high-frequency patterns embedded inline (`[object Object]`,
    empty category page, cart 422 sellability, 500 server_error, missing images,
    captcha, scope 403, stale cache, localhost cookies, prerender empty page).

  All three are self-contained (no dependency on monorepo docs), so external
  developers building their own storefront get complete standalone guides.

## 0.2.2

### Minor Changes

- **`proxima skills list`** and **`proxima skills install`** — bundled agent skills for Cursor (`.cursor/skills/`) and Claude Code (`.claude/skills/`). Includes `website-deploy`, `wire-cms-sections`, `add-section`, `new-storefront-app`, `ecommerce-audit`, `seo`, and OpenSpec workflow skills.
- SDK docs refreshed: mental model, architecture, sections, deploy, template authoring, agent skills guide (`docs/10-agent-skills.md`).

## 0.2.1

### Patch Changes

- Publish `WebsiteDeployClient` in template-registry-client and fix broken global `@proxima-io/cli` install (templateizer imported symbols missing from npm 0.1.0).
- Updated dependencies
  - @proxima-io/templateizer@0.2.1

## 0.2.0

### Minor Changes

- fbf3a70: Initial release of `@proxima-io/cli` — global `proxima` command with monorepo workspace discovery, deploy/init/template shortcuts, and Caddy route checks. Delegates to `@proxima-io/templateizer`.

## 0.1.0

### Minor Changes

- Initial release: global `proxima` CLI with monorepo workspace discovery
- Commands: `list`, `init`, `deploy`, `validate`, `template:create`, `template:publish`, `caddy check`
- Delegates to `@proxima-io/templateizer` engine
