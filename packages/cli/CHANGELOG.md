# @proxima-io/cli

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
