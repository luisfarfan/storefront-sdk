# Spec: Render Locale Contract

## ADDED Requirements

### Requirement: fetchProximaRender accepts locale
`fetchProximaRender(config)` SHALL accept optional `locale: string` and pass it as query param and `Accept-Language` header.

#### Scenario: Explicit English render
- **WHEN** `fetchProximaRender({ path: "/catalog", locale: "en", ... })`
- **THEN** the HTTP request includes `?locale=en` and `Accept-Language: en`

### Requirement: TypeScript types include localized paths
`PageSummary` / render website types SHALL include optional `localized_paths?: Record<string, string>` and `enabled_locales?: string[]`.
