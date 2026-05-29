# proxima-storefront-sdk

Monorepo de paquetes SDK para storefronts y templates de Proxima.

## Paquetes

### Para storefronts Astro

| Paquete | Descripción | README |
|---------|-------------|--------|
| [`@proxima-io/storefront-core`](packages/storefront-core) | Cliente HTTP principal — composición CMS, catálogo, auth de compradores, carrito, órdenes, wishlist, SEO y analytics | [README](packages/storefront-core/README.md) |
| [`@proxima-io/storefront-cms`](packages/storefront-cms) | Normalización de secciones, resolución de tenant y detección de preview | [README](packages/storefront-cms/README.md) |
| [`@proxima-io/storefront-commerce`](packages/storefront-commerce) | Tipos de commerce compartidos (`ResolverKind`) y helpers | [README](packages/storefront-commerce/README.md) |
| [`@proxima-io/storefront-builder-sdk`](packages/storefront-builder-sdk) | Bridge postMessage con el Builder visual + componentes Astro editables | [README](packages/storefront-builder-sdk/README.md) |

### CLI (devDependency)

| Paquete | Descripción | README |
|---------|-------------|--------|
| [`@proxima-io/templateizer`](packages/templateizer) | **CLI** — deploy de websites, gestión de templates, `init`, `validate` | [README](packages/templateizer/README.md) |

### Internos del CLI — no instalar directamente

Usados solo por `templateizer`. No aparecen en el `package.json` de tu storefront.

| Paquete | Descripción | README |
|---------|-------------|--------|
| [`@proxima-io/template-schema`](packages/template-schema) | Schemas Zod y tipos para `proxima.website.json` y `proxima.template.json` | [README](packages/template-schema/README.md) |
| [`@proxima-io/template-registry-client`](packages/template-registry-client) | Cliente HTTP para el registro de templates de Proxima | [README](packages/template-registry-client/README.md) |

## Instalación según caso de uso

```bash
# Storefront Astro completo (con Builder visual de Proxima)
pnpm add @proxima-io/storefront-core @proxima-io/storefront-cms \
         @proxima-io/storefront-commerce @proxima-io/storefront-builder-sdk

# Storefront sin Builder (solo CMS + catálogo)
pnpm add @proxima-io/storefront-core @proxima-io/storefront-cms \
         @proxima-io/storefront-commerce

# CLI para deploy — siempre devDependency, nunca en producción
pnpm add -D @proxima-io/templateizer

# template-schema y template-registry-client NO se instalan directamente
# son dependencias internas del CLI
```

## Primeros pasos con el CLI

```bash
# Setup interactivo — crea .proxima/credentials.json
npx proxima-templateizer init

# Deploy de section types + páginas a tu website
npx proxima-templateizer website-deploy

# Ver todos los comandos disponibles
npx proxima-templateizer
```

→ Ver [docs/09-deploy.md](docs/09-deploy.md) para el flujo completo de deploy.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [01 — Mental model](docs/01-mental-model.md) | Jerarquía Website → Pages → Sections → Attributes |
| [02 — Quick start](docs/02-quick-start.md) | Setup en 10 minutos |
| [03 — Architecture](docs/03-architecture.md) | Organización de archivos de un storefront |
| [04 — Sections & Attributes](docs/04-sections-and-attributes.md) | Tipos de sección y atributo |
| [05 — Smart collections](docs/05-smart-collections.md) | Smart collections y placeholders |
| [06 — Builder integration](docs/06-builder-integration.md) | Integración con el Builder visual |
| [07 — Commerce](docs/07-commerce.md) | Carrito, órdenes, checkout |
| [08 — Template authoring](docs/08-template-authoring.md) | Publicar templates en el Marketplace |
| [09 — Deploy](docs/09-deploy.md) | `website-deploy` — deploy a un website de cliente |

## Stack

- **pnpm workspaces** — gestión de paquetes en monorepo
- **Turborepo** — build orchestration con caché
- **TypeScript strict** — en todos los paquetes
- **Vitest** — tests en todos los paquetes
- Solo `storefront-builder-sdk` tiene peer dependency de Astro

## Comandos del monorepo

```bash
pnpm install        # instalar dependencias
pnpm build          # buildear todos los paquetes en orden
pnpm test           # correr todos los tests
pnpm typecheck      # type check en todos los paquetes
```
