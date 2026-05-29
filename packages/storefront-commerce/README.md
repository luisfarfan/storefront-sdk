# @proxima-io/storefront-commerce

Tipos y helpers de commerce compartidos para storefronts Proxima.

## Instalación

```bash
pnpm add @proxima-io/storefront-commerce
```

## Qué exporta

### `ResolverKind`

Tipo TypeScript que representa los tipos de página que puede resolver un storefront:

```ts
import type { ResolverKind } from '@proxima-io/storefront-commerce';

// Valores posibles:
// 'content_page'    → página estática (Home, Nosotros, Contacto…)
// 'product_detail'  → detalle de producto
// 'category_detail' → listado de categoría
// 'brand_detail'    → página de marca
// 'search'          → resultados de búsqueda
// 'product_list'    → listado general de productos
// 'cart'            → carrito
// 'checkout'        → checkout
// 'buyer_login'     → login del comprador
// 'buyer_account'   → cuenta del comprador
```

### `isCommerceResolver(kind)`

Devuelve `true` si el `resolver_kind` es una página de flujo commerce (carrito, checkout, cuenta).

```ts
import { isCommerceResolver } from '@proxima-io/storefront-commerce';

if (isCommerceResolver(composition.resolver_kind)) {
  // Proteger la ruta — solo accesible si el comprador está autenticado
}
```

Útil en el middleware de Astro para proteger rutas que requieren autenticación.

## Uso típico

Este paquete se usa principalmente para tipar el `resolver_kind` que devuelve `fetchProximaComposition` de `@proxima-io/storefront-core`:

```ts
import type { ResolverKind } from '@proxima-io/storefront-commerce';
import { isCommerceResolver } from '@proxima-io/storefront-commerce';

// En middleware.ts
const composition = await fetchProximaComposition(config, website);
const kind = composition.resolver_kind as ResolverKind;

if (isCommerceResolver(kind) && !buyer) {
  return redirect('/login');
}
```
