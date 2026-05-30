# @proxima-io/cli

Global CLI for Proxima storefronts. Discovers monorepo workspaces, deploys manifests, publishes templates, and **installs agent skills** for Cursor / Claude Code.

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

# Agent skills (any repo)
proxima skills list
proxima skills install
proxima skills install website-deploy wire-cms-sections --cursor
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
| `skills list` | List bundled agent skills |
| `skills install [flags] [skill...]` | Copy skills to `.cursor/skills` / `.claude/skills` |

### Skills flags

| Flag | Effect |
|------|--------|
| `--cursor` | Install only to `.cursor/skills/` |
| `--claude` | Install only to `.claude/skills/` |
| `--global` | Install to user home instead of project |
| `--force` | Overwrite existing skill directories |

Bundled skills: `website-deploy`, `wire-cms-sections`, `add-section`, `new-storefront-app`, `ecommerce-audit`, `seo`, `openspec-*`.

See [docs/10-agent-skills.md](../../docs/10-agent-skills.md) and [skills/README.md](./skills/README.md).

## Discovery

The CLI walks up from the current directory looking for `apps/*/proxima.website.json` (also `templates/*` and `sites/*`).

Slugs map to `apps/<slug>` automatically when run from the monorepo root.
