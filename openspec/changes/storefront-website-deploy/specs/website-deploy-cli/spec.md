# Spec: website-deploy-cli

Changes to `packages/templateizer` — new `website-deploy` command.

---

## Command

```bash
templateizer website-deploy [target] [options]
```

`target` defaults to `.` (current directory). The command looks for `proxima.website.json`
in the target directory.

---

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Print the payload that would be sent. No API call. |
| `--force` | Allow breaking changes (attribute type changes, renames). |
| `--domain <domain>` | Override `PROXIMA_DOMAIN` from `.env`. |
| `--service-key <key>` | Override `PROXIMA_SERVICE_KEY` from `.env`. |
| `--api-url <url>` | Override `PROXIMA_API_URL` from `.env`. |

---

## Execution flow

```
1. Resolve target path (default: cwd)
2. Find proxima.website.json in target directory
   → If not found: error "proxima.website.json not found. Run from your storefront project root."
3. Parse and validate manifest using validateWebsiteDeployManifest()
   → If invalid: print each Zod issue with field path and message, exit 1
4. Resolve credentials:
   a. PROXIMA_API_URL: --api-url flag || env var || error
   b. PROXIMA_SERVICE_KEY: --service-key flag || PROXIMA_SERVICE_KEY env var || error
   c. PROXIMA_DOMAIN: --domain flag || PROXIMA_DOMAIN env var || error
5. If --dry-run:
   → Print JSON payload that would be sent, exit 0
6. Create WebsiteDeployClient({ apiUrl, serviceKey })
7. Call client.deploy(domain, manifest, { force: hasForceFlag })
8. On success: print human-readable diff summary, exit 0
9. On WebsiteDeployClientError with status=409:
   → Print breaking changes table
   → Print "Re-run with --force to override"
   → exit 1
10. On WebsiteDeployClientError with status=404:
    → Print "Website '{domain}' not found. Verify PROXIMA_DOMAIN matches a website in the admin."
    → exit 1
11. On other errors: print error message, exit 1
```

---

## Output format

### Success

```
✓ Connected to tienda-deportes.proxima.app (website #7)

Section types
  + created    category_grid
  + created    search
  ~ updated    hero  (1 attribute changed)
  · unchanged  header, product_grid, footer

Pages
  + created    /  →  scaffolded [header, hero, product_grid, category_grid, footer]
  + created    product_detail  →  scaffolded [header, footer]
  + created    category_detail  →  scaffolded [header, product_grid, footer]
  · skipped    search  (has merchant sections — not modified)

⚠ Warnings
  · Attribute 'columns' added with is_required=true to 'product_grid'
    3 existing sections have no value for this field

✓ Deploy completed in 1.4s
```

### Breaking change (409)

```
✗ Deploy blocked — breaking changes detected:

  Section type: hero
  Attribute:    headline
  Change:       type changed from 'text' to 'rich_text'

Re-run with --force to apply these changes.
Note: existing attribute content may be incompatible with the new type.

Exit code: 1
```

### Dry run

```
Dry run — no API call made.

Payload:
{
  "website_domain": "tienda-deportes.proxima.app",
  "section_types": [...],
  "pages": [...]
}
```

### Validation errors

```
✗ Invalid proxima.website.json:

  pages[0].scaffold_sections[2].section_type: section_type 'banner' not declared in section_types
  pages[2].path: pages with resolver_kind 'content_page' require a 'path' field

Fix the errors above and re-run.
Exit code: 1
```

---

## `.env` loading

The command does not depend on `dotenv` being installed in the project.
It reads the `.env` file from the target directory manually using Node.js `fs.readFileSync`
and parses it with a minimal key=value parser. This avoids adding a dependency.

Only the following keys are read from `.env`:
- `PROXIMA_API_URL`
- `PROXIMA_SERVICE_KEY`
- `PROXIMA_DOMAIN`

Values already set in `process.env` take precedence over `.env` file values
(standard behavior — allows CI environments to override without modifying the file).
