# @proxima-io/cli

Global CLI for Proxima storefronts. Discovers monorepo workspaces and delegates to `@proxima-io/templateizer`.

## Install

```bash
npm install -g @proxima-io/cli
```

Monorepo local development:

```bash
cd proxima-storefront-sdk
pnpm install
pnpm --filter @proxima-io/cli build
npm link --workspace @proxima-io/cli
```

## Usage

```bash
proxima list
proxima init 214store
proxima deploy 214store
proxima deploy nocturna --dry-run
proxima template:publish 214store --local-only
proxima caddy check
```

Inside a single app directory, the slug is optional:

```bash
cd apps/214store
proxima deploy
```

Advanced commands pass through to templateizer:

```bash
proxima website-deploy apps/nocturna --yes
proxima template-create 214store --publish-manifest --local-only
```

## Commands

| Command | Action |
|---------|--------|
| `list` | Show discovered storefront workspaces |
| `init [slug]` | Create `.proxima/credentials.json` |
| `deploy [slug]` | Run `website-deploy` |
| `validate [slug]` | Validate `proxima.website.json` |
| `template:create [slug]` | Register/update marketplace template row |
| `template:publish [slug]` | `template-create --publish-manifest` |
| `caddy check` | Compare Caddyfile routes vs known domains |

## Discovery

The CLI walks up from the current directory looking for `apps/*/proxima.website.json` (also `templates/*` and `sites/*`).

Slugs map to `apps/<slug>` automatically when run from the monorepo root.
