# proxima-storefront-sdk

Monorepo centralizado de paquetes SDK para storefronts y templates de Proxima.

## Paquetes

| Paquete | Descripción | Consumidores |
|---|---|---|
| [`@proxima/storefront-cms`](packages/storefront-cms) | Normalización de secciones CMS, tenant resolution, preview detection, API client factory | Cualquier storefront Astro |
| [`@proxima/storefront-core`](packages/storefront-core) | HTTP client para Proxima API — websites, composiciones, productos | Cualquier storefront Astro |
| [`@proxima/storefront-commerce`](packages/storefront-commerce) | Helpers de commerce y tipos centrales (`DeliveryMode`, `ResolverKind`, etc.) | Cualquier storefront Astro |
| [`@proxima/storefront-builder-sdk`](packages/storefront-builder-sdk) | Bridge postMessage con Proxima Builder + componentes Astro editables | Solo proyectos Astro |
| [`@proxima/template-schema`](packages/template-schema) | Schema Zod y tipos TypeScript para `proxima.template.json` | CLI, proxima-api, CI |
| [`@proxima/template-registry-client`](packages/template-registry-client) | HTTP client para el registro admin de website templates | CLI, CI/CD pipelines |
| [`@proxima/templateizer`](packages/templateizer) | CLI para gestionar templates — scan, validate, register, deploy, publish, sync, status | Devs de templates |

## Stack

- **pnpm workspaces** — gestión de paquetes
- **Turborepo** — build orchestration con caché
- **TypeScript** — strict mode en todos los paquetes
- **Vitest** — tests en todos los paquetes
- El único paquete con dependencia de Astro es `storefront-builder-sdk`

## Comandos

```bash
# Instalar dependencias
pnpm install

# Buildear todos los paquetes (en orden correcto)
pnpm build

# Correr todos los tests
pnpm test

# Type check
pnpm typecheck
```

## Instalación en un storefront

```bash
# Un storefront Astro managed
pnpm add @proxima/storefront-cms @proxima/storefront-core @proxima/storefront-builder-sdk

# Un storefront solo con CMS (sin builder preview)
pnpm add @proxima/storefront-cms @proxima/storefront-core

# Un pipeline de CI para templates
pnpm add @proxima/template-registry-client @proxima/template-schema

# El CLI de templates (global o como devDependency)
pnpm add -D @proxima/templateizer
```
