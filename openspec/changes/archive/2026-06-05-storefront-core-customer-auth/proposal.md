# Proposal: Customer Auth & Profile SDK — storefront-core

## ¿Qué problema resuelve?

El proxima-api acaba de recibir un conjunto grande de features para el registro y perfil de clientes:
formulario de registro configurable por comercio, campos extendidos de perfil, wishlist, y flujos
completos de auth (forgot/reset password, verificación de email, refresh de token).

El SDK (`storefront-core`) tiene funciones para auth y carrito pero están **parcialmente
desactualizadas** o **incompletas** respecto a lo que la API ahora soporta:

- `registerBuyer` solo acepta `email`, `password`, `fullName`. La API ahora acepta 9+ campos.
- `BuyerProfile` no tiene `doc_type`, `doc_number`, `birth_date`, `newsletter_subscribed`,
  `avatar_url`, `metadata`, `registration_source`, `last_login_at`.
- No existe `fetchRegistrationForm` — el formulario es dinámico y configurable por comercio,
  el storefront no puede hardcodearlo.
- No existe ningún helper para forgot/reset password ni verificación de email.
- No existe ningún helper para refresh de token.
- No existe nada para wishlist.
- `processBuyerRegister` (server-side helper) tampoco acepta los campos nuevos.

Sin estos métodos, cada storefront Astro tiene que reimplementar la comunicación con la API
manualmente, perdiendo la capa de abstracción que el SDK debe proveer.

## ¿Qué cambia?

### Paquete afectado
`@proxima-io/storefront-core` — el archivo único `src/index.ts`.

### Alcance
1. **Tipos actualizados**: `BuyerProfile`, `BuyerSession`, `AddressInput`, `CustomerAddress`
2. **Tipos nuevos**: `RegistrationFormField`, `RegistrationFormStep`, `RegistrationForm`,
   `WishlistItem`, `BuyerRegisterParams`, `MissingFieldsError`
3. **Funciones client-side nuevas**: `fetchRegistrationForm`, `updateBuyerProfile`,
   `refreshBuyerToken`, `forgotPassword`, `resetPassword`, `verifyEmail`,
   `resendVerification`, `fetchWishlist`, `addToWishlist`, `removeFromWishlist`
4. **Funciones client-side actualizadas**: `registerBuyer` (nuevos campos)
5. **Server-side helpers nuevos**: `processRefreshToken`, `processForgotPassword`,
   `processResetPassword`, `processVerifyEmail`
6. **Server-side helpers actualizados**: `processBuyerRegister` (nuevos campos)

### Lo que NO cambia
- Firmas existentes de `loginBuyer`, `logoutBuyer`, `fetchBuyerProfile`,
  `fetchCart`, `addToCart`, `updateCartItem`, `removeCartItem`, `createOrder`,
  `fetchOrders`, `fetchOrder`, `fetchCustomerAddresses`, `createCustomerAddress`,
  `updateCustomerAddress`, `deleteCustomerAddress`, `setDefaultAddress`, `searchUbigeo`,
  `analytics`. Todos siguen funcionando igual — no hay breaking changes.
- El paquete `storefront-commerce`, `storefront-cms`, y los demás — no se tocan.

## Motivación

El storefront Astro necesita implementar:
1. Una página de registro dinámica que renderice el formulario según la config del comercio
2. Una página de login
3. Recuperación de contraseña completa (forgot → email → reset)
4. Verificación de email
5. Página de perfil del cliente con todos los campos
6. Wishlist accesible desde el header y páginas de producto
7. Refresh silencioso de tokens para no forzar re-login

Sin el SDK cubriendo todo esto, cada template y cada storefront custom lo implementa
diferente, con bugs distintos, y acoplado directamente a los endpoints de la API.
