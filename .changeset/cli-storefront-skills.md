---
"@proxima-io/cli": minor
---

Three new bundled agent skills, installable via `proxima skills install`:

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
