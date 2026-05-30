# Spec: Wishlist

## Endpoints
```
GET    /api/v1/store/me/wishlist
POST   /api/v1/store/me/wishlist
DELETE /api/v1/store/me/wishlist/{product_id}
Headers: Authorization: Bearer <token>, X-Business-ID
```

Todos requieren autenticación.

## Tipo nuevo

```typescript
interface WishlistItem {
  id: number;
  customer_id: number;
  business_id: string;
  product_id: string;   // UUID del producto en el catálogo
  variant_id: string | null;
  notes: string | null;
  added_at: string;     // ISO datetime
}
```

## Funciones

### fetchWishlist

```typescript
fetchWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string }
): Promise<WishlistItem[]>
```

Devuelve todos los items del wishlist del cliente autenticado, ordenados por `added_at` desc.

---

### addToWishlist

```typescript
addToWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: {
    token: string;
    productId: string;
    variantId?: string | null;
    notes?: string | null;
  }
): Promise<WishlistItem>
```

**Comportamiento idempotente**: si el producto ya está en el wishlist, devuelve el item
existente sin crear un duplicado (el backend maneja esto — el status sigue siendo 201).

---

### removeFromWishlist

```typescript
removeFromWishlist(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string; productId: string }
): Promise<void>
```

- Si el producto no estaba en el wishlist: lanza `{ status: 404 }`.
- En éxito: resuelve sin valor (204 No Content).

---

## Patrones de uso en Astro

### Botón "Guardar en wishlist" (componente cliente)

```
client:load component recibe: productId, token (desde cookie), businessId
→ al hacer click: llama addToWishlist
→ en éxito: cambia ícono a "guardado"
→ en 401: redirige a login
```

### Página de wishlist (server-side)

```
// src/pages/account/wishlist.astro
const token = Astro.cookies.get("buyer_token")?.value;
if (!token) return redirect("/login");
const items = await fetchWishlist({ baseUrl: env.apiUrl }, website, { token });
```

### Contador en header (client-side)

El SDK no provee un store reactivo para el contador. El storefront lo implementa
con Nano Stores o Svelte stores, inicializando con `fetchWishlist` en el mount
del componente de header.

---

## Notas

- `product_id` es un UUID que referencia el catálogo. El SDK no valida que el producto
  exista — esa validación es responsabilidad del storefront antes de llamar a `addToWishlist`.
- El wishlist está **aislado por business_id** — un cliente registrado en dos comercios
  tiene wishlists separados.
- No hay paginación en el wishlist — la API devuelve todos los items. Si un comercio
  tiene clientes con wishlists muy grandes (>100 items), considerar paginación en el futuro.
