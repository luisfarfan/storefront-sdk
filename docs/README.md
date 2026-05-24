# Guía para developers — Proxima Storefront

Esta guía explica cómo construir una website completa sobre el ecosistema Proxima,
desde el primer `pnpm install` hasta tener un storefront con CMS, commerce y builder integrados.

## ¿A quién va dirigida?

A developers de Astro que quieren construir o migrar una website al ecosistema Proxima.
Se asume conocimiento de Astro (componentes, SSR, API routes, middleware) pero no de Proxima.

---

## Índice

| # | Documento | Qué aprenderás |
|---|-----------|----------------|
| 1 | [Modelo mental](./01-mental-model.md) | Cómo piensa Proxima: Website → Pages → Sections → Attributes → SmartCollections |
| 2 | [Quick start](./02-quick-start.md) | Proyecto funcionando en 10 minutos |
| 3 | [Arquitectura de archivos](./03-architecture.md) | Estructura de carpetas, routing, section router |
| 4 | [Sections y Attributes](./04-sections-and-attributes.md) | Definir secciones, los 9 tipos de atributos |
| 5 | [Smart Collections](./05-smart-collections.md) | Datos dinámicos: productos, categorías, marcas |
| 6 | [Builder integration](./06-builder-integration.md) | EditableSection, EditableAttribute, preview bridge |
| 7 | [Commerce](./07-commerce.md) | Auth, carrito, checkout, wishlist, búsqueda, órdenes |
| 8 | [Template authoring](./08-template-authoring.md) | De storefront a template reutilizable en el marketplace |
| 9 | [Deploy](./09-deploy.md) | Subir la estructura a la API para que el comercio pueda editar |

---

## El proyecto starter

Si prefieres arrancar directo con código, el directorio `examples/storefront-starter/`
contiene un proyecto Astro completo que implementa todos los patrones de esta guía.

```bash
cp -r examples/storefront-starter mi-proyecto
cd mi-proyecto
pnpm install
cp .env.example .env
# Editar .env con tus credenciales
pnpm dev
```

---

## SDK — Paquetes disponibles

| Paquete | Propósito |
|---------|-----------|
| `@proxima-io/storefront-core` | HTTP client: websites, composición, auth, carrito, wishlist, búsqueda, analytics |
| `@proxima-io/storefront-cms` | Normalización CMS, preview detection, props para builder |
| `@proxima-io/storefront-builder-sdk` | Bridge iframe + componentes `EditableSection`, `EditableAttribute` |
| `@proxima-io/storefront-commerce` | Tipos compartidos: `ResolverKind`, `DeliveryMode`, `WebsiteCapabilities` |

```bash
pnpm add @proxima-io/storefront-core @proxima-io/storefront-cms @proxima-io/storefront-builder-sdk @proxima-io/storefront-commerce
```
