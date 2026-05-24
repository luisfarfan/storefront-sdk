# Proxima Storefront Starter

Punto de partida para construir un storefront completo sobre Proxima con Astro.

Incluye autenticación de compradores, carrito, búsqueda y las secciones más comunes
listas para usar.

## Stack

- **Astro 4** con SSR (`output: 'server'`)
- **@proxima-io/storefront-core** — cliente HTTP para la API de Proxima
- **@proxima-io/storefront-cms** — helpers de normalización y detección de preview
- **@proxima-io/storefront-builder-sdk** — integración con el Builder (EditableSection, etc.)

## Requisitos

- Node.js 22+
- pnpm 9+
- Una cuenta en Proxima con al menos un Website configurado

## Inicio rápido

```bash
# 1. Copiar el starter
cp -r examples/storefront-starter mi-tienda
cd mi-tienda

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# → Editar .env con tus credenciales de Proxima

# 4. Iniciar en desarrollo
pnpm dev
# → http://localhost:4321
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `PROXIMA_API_URL` | URL base de la API (e.g. `https://api.proxima.io`) |
| `PROXIMA_DOMAIN` | Dominio del storefront (debe coincidir con el Website en el admin) |
| `PROXIMA_SERVICE_KEY` | Service key del tenant |
| `PROXIMA_BUSINESS_ID` | Business ID del tenant |
| `PUBLIC_PROXIMA_API_URL` | Igual que `PROXIMA_API_URL` pero expuesto al browser |

## Estructura

```
src/
  lib/
    proxima.ts          # Config + getWebsite() cacheado
  middleware/
    index.ts            # Validación de sesión del buyer
  layouts/
    BaseLayout.astro    # HTML base con bridge, carrito y analytics
  sections/
    index.ts            # Section router (SECTION_MAP)
    HeaderSection.astro
    HeroSection.astro
    ProductGridSection.astro
    CategoryGridSection.astro
    SearchSection.astro
    FooterSection.astro
  components/
    ProductCard.astro
    CartDrawer.astro
  pages/
    [...path].astro     # Catch-all: maneja todas las rutas via composición
    api/
      buyer/
        login.ts
        register.ts
        logout.ts
        refresh.ts
      cart/
        index.ts
        add.ts
        remove.ts
        checkout.ts
      coupon/
        validate.ts
      wishlist/
        index.ts
```

## Archivos de manifiesto

El starter incluye dos archivos JSON en la raíz. Son para flujos completamente distintos:

### `proxima.website.json` — Deploy a un cliente

Define la estructura del website de **un cliente concreto**: qué section types existen,
qué páginas tiene, y con qué secciones se scaffoldea cada página por primera vez.

```json
{
  "schema_version": "1.0",
  "section_types": [
    {
      "key": "hero",
      "label": "Hero Principal",
      "category": "content",
      "attribute_schema": [
        { "name": "image", "label": "Imagen", "type": "image", "is_required": true, "order": 1 },
        { "name": "headline", "label": "Título", "type": "text", "localizable": true, "order": 2 }
      ]
    }
  ],
  "pages": [
    {
      "resolver_kind": "content_page",
      "path": "/",
      "label": "Home",
      "scaffold_sections": [
        { "section_type": "hero", "order": 1 }
      ]
    }
  ]
}
```

Regla fundamental: **cada sección en `src/sections/` debe estar en `section_types`**,
y los `key` deben coincidir exactamente con los de `SECTION_MAP`.

### `proxima.template.json` — Marketplace de Proxima

Define el storefront como **template reutilizable** para el Proxima Marketplace.
Otros comercios podrán instalarlo desde el marketplace. Incluye campos adicionales
como `template_key`, `renderer` por sección, `deployment_config`, etc.

Este archivo solo se usa si querés publicar el storefront como template genérico.
**Si estás construyendo para un cliente concreto, no necesitás tocarlo.**

| Archivo | Comando | Para qué |
|---------|---------|----------|
| `proxima.website.json` | `templateizer website-deploy` | Deployar a un website específico |
| `proxima.template.json` | `templateizer register/publish` | Publicar en el Marketplace |

## Añadir una nueva sección

1. Crear `src/sections/MiSeccionSection.astro`
2. Añadirla al `SECTION_MAP` en `src/sections/index.ts`
3. Añadir su entrada en `proxima.website.json` bajo `section_types`
4. Correr `templateizer website-deploy` para subirla a la API

```ts
// src/sections/index.ts
import MiSeccionSection from './MiSeccionSection.astro';

export const SECTION_MAP = {
  // ...existentes
  mi_seccion: MiSeccionSection,
};
```

```json
// proxima.website.json — agregar en section_types
{
  "key": "mi_seccion",
  "label": "Mi Sección",
  "category": "content",
  "attribute_schema": [
    { "name": "title", "label": "Título", "type": "text", "order": 1 }
  ]
}
```

## API Routes disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/buyer/login` | POST | Iniciar sesión |
| `/api/buyer/register` | POST | Registrar nuevo comprador |
| `/api/buyer/logout` | POST | Cerrar sesión |
| `/api/buyer/refresh` | POST | Renovar token de sesión |
| `/api/cart` | GET | Obtener carrito actual |
| `/api/cart/add` | POST | Agregar item al carrito |
| `/api/cart/remove` | DELETE | Eliminar item del carrito |
| `/api/cart/checkout` | POST | Confirmar orden |
| `/api/coupon/validate` | GET | Validar cupón de descuento |
| `/api/wishlist` | GET/POST/DELETE | Gestionar lista de deseos |

## Deploy al cliente

Una vez que el storefront está listo, sube la estructura a la API para que el
comercio pueda editar su website desde el Builder:

```bash
# 1. Asegurarse de que .env tiene las credenciales
#    PROXIMA_API_URL, PROXIMA_DOMAIN, PROXIMA_SERVICE_KEY

# 2. Ver qué se enviaría sin hacer la llamada (opcional)
templateizer website-deploy --dry-run

# 3. Subir section types + páginas a la API
templateizer website-deploy

# → El Builder ya muestra las secciones disponibles
# → Las páginas tienen su estructura inicial lista para que el comercio edite
```

En CI, podés pasar las credenciales como flags:

```bash
templateizer website-deploy \
  --api-url https://api.proxima.io \
  --service-key sk_live_... \
  --domain tienda.proxima.app
```

El deploy es **100% idempotente**: solo aplica los cambios nuevos, nunca sobreescribe
contenido que el comercio ya configuró.

Ver la guía completa en [docs/09-deploy.md](../../docs/09-deploy.md).

## Docs

Ver la guía completa en [`docs/`](../../docs/):

1. [Modelo mental](../../docs/01-mental-model.md)
2. [Quick start](../../docs/02-quick-start.md)
3. [Arquitectura](../../docs/03-architecture.md)
4. [Sections y Attributes](../../docs/04-sections-and-attributes.md)
5. [Smart Collections](../../docs/05-smart-collections.md)
6. [Builder Integration](../../docs/06-builder-integration.md)
7. [Commerce](../../docs/07-commerce.md)
8. [Template Authoring](../../docs/08-template-authoring.md)
9. [Deploy](../../docs/09-deploy.md)
