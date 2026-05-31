# Proxima agent skills

Workflow skills for **Cursor** and **Claude Code** when building Proxima storefronts.

Shipped inside `@proxima-io/cli` — install into any repo:

```bash
npm install -g @proxima-io/cli

# List bundled skills
proxima skills list

# Install all skills into current project (.cursor + .claude)
proxima skills install

# Cursor only, single skill
proxima skills install website-deploy --cursor

# User-wide (all projects)
proxima skills install --global

# Overwrite existing copies
proxima skills install --force
```

## Bundled skills

| Skill | When to use |
|-------|-------------|
| `website-deploy` | Deploy `proxima.website.json`, debug Builder/deploy errors |
| `wire-cms-sections` | Connect existing Astro sections to CMS (schema + EditableAttribute) |
| `add-section` | Add a new CMS-editable section to a storefront |
| `add-page` | Add a new page to a storefront (prerender rules, manifest, deploy) |
| `add-smart-collection` | Add a dynamic catalog collection (product rail, category grid, brand strip) |
| `debug-storefront` | Triage storefront bugs (empty page, [object Object], broken cart, etc.) |
| `new-storefront-app` | Scaffold a new storefront app (monorepo pattern) |
| `ecommerce-audit` | UX/CRO audit of a Proxima storefront |
| `seo` | SEO setup and best practices for storefronts |
| `openspec-*` | OpenSpec change workflow (optional; monorepo proposals) |

After install, agents discover skills from:

- **Cursor:** `.cursor/skills/<name>/SKILL.md` (project) or `~/.cursor/skills/` (global)
- **Claude Code:** `.claude/skills/<name>/SKILL.md` (project) or `~/.claude/skills/` (global)

## Scope and limitations

| Skill | Best for | Notes |
|-------|----------|-------|
| `website-deploy`, `wire-cms-sections`, `add-section` | Any Astro storefront with `proxima.website.json` | Examples use `apps/{slug}/` — adapt paths in standalone repos |
| `new-storefront-app`, `ecommerce-audit` | **proxima-storefronts monorepo** | Assume `apps/*`, Caddyfile, root `package.json` |
| `seo` | Storefronts following 214store SEO pattern | References `SiteLayout`, `StorefrontShell`, SDK `buildPageSeo()` |
| `openspec-*` | Repos with **`openspec/changes/`** | Requires OpenSpec CLI; mainly proxima-storefronts SDK workflow |

Skills are maintained in this directory. Run `proxima skills install --force` after upgrading `@proxima-io/cli`.
