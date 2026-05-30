export function printHelp(): void {
  console.log(`@proxima-io/cli — Proxima storefront command line

Usage:
  proxima list
  proxima caddy check
  proxima init [slug|path] [flags...]
  proxima deploy [slug|path] [flags...]
  proxima validate [slug|path]
  proxima template:create [slug|path] [flags...]
  proxima template:publish [slug|path] [flags...]
  proxima <templateizer-command> [slug|path] [flags...]

Shortcuts
  deploy              → website-deploy
  template:create     → template-create
  template:publish    → template-create --publish-manifest

Discovery
  When run from a monorepo root, \`proxima list\` finds apps/*/proxima.website.json.
  Commands accept a slug (e.g. 214store) or a path (e.g. apps/214store).
  Inside a single app directory, the slug is optional.

Examples
  proxima list
  proxima init 214store
  proxima deploy nocturna --dry-run
  proxima template:publish 214store --local-only
  proxima website-deploy apps/214store --yes
  proxima caddy check

Install globally
  npm install -g @proxima-io/cli

Credentials
  Run \`proxima init <slug>\` to create .proxima/credentials.json per storefront.
  See \`proxima-templateizer --help\` for full templateizer flags and env vars.
`);
}
