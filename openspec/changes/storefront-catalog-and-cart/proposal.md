# Proposal: Storefront Catalog & Cart SDK

## Contexto

El storefront usa la arquitectura **composition-first**: cada página se resuelve con
`fetchProximaComposition`, que ya embebe productos/categorías/marcas via smart collections
y `resolved_data`. El SDK **no necesita** funciones para product detail, category detail
ni brand detail (esos datos llegan solos en la composición).

Lo que sí falta son las llamadas que el storefront hace **fuera del ciclo de página**:
interacciones client-side (filtros/paginación), búsqueda en vivo, merge de carrito al
hacer login, y validación de cupones en el checkout.

## Funciones a agregar

### Catálogo storefront (client-side / SSR secundario)

| Función | Endpoint | Cuándo se usa |
|---------|----------|--------------|
| `searchStorefront` | `GET /storefront/search` | Barra de búsqueda, página de resultados |
| `fetchStorefrontProducts` | `GET /storefront/products` | Listado general con filtros client-side |
| `fetchCategoryProducts` | `GET /storefront/categories/{slug}/products` | Paginación/filtros dentro de una CLP |
| `fetchBrandProducts` | `GET /storefront/brands/{slug}/products` | Paginación/filtros dentro de una BLP |
| `fetchCategoriesDirectory` | `GET /storefront/categories` | Sitemap, menú de navegación |
| `fetchBrandsDirectory` | `GET /storefront/brands` | Sitemap, menú de navegación |

### Carrito

| Función | Endpoint | Cuándo se usa |
|---------|----------|--------------|
| `mergeGuestCart` | `POST /cart/merge` | Al hacer login con carrito guest activo |
| `validateCoupon` | `GET /commerce/coupons/validate` | UI del checkout antes de confirmar |

### Deprecación

`fetchProximaProducts` llama a `/api/v1/products` (endpoint raw de admin). Se marca
`@deprecated` en JSDoc — los storefronts deben usar `fetchStorefrontProducts`.

## No se agrega

- `GET /storefront/products/{slug}` — los datos del PDP vienen en `resolved_data`
- `GET /storefront/categories/{slug}` — ídem CLP
- `GET /storefront/brands/{slug}` — ídem BLP
- `POST /commerce/checkout/direct` — caso de uso muy específico (SaaS/planes), se agrega solo si se necesita
- `POST /store/auth/logout-all` — raramente necesario en storefronts
