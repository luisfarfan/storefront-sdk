# Tasks: Customer Auth & Profile SDK

Archivo: `packages/storefront-core/src/index.ts`
Después de cada cambio: `pnpm --filter storefront-core build && pnpm --filter storefront-core test`

---

## 1. Tipos actualizados

- [x] 1.1 Actualizar `BuyerProfile` con campos: `doc_type`, `doc_number`, `birth_date`,
      `newsletter_subscribed`, `avatar_url`, `metadata`, `registration_source`, `last_login_at`
- [x] 1.2 Actualizar `AddressInput` con campos opcionales: `latitude`, `longitude`, `geocoding_source`
- [x] 1.3 Actualizar `CustomerAddress` con campos opcionales: `latitude`, `longitude`,
      `geocoding_source`, `updated_at`

## 2. Tipos nuevos — Registration Form

- [x] 2.1 Agregar interfaz `RegistrationFormField`
- [x] 2.2 Agregar interfaz `RegistrationFormStep`
- [x] 2.3 Agregar interfaz `RegistrationForm`
- [x] 2.4 Agregar interfaz `AddressInRegistration`
- [x] 2.5 Agregar interfaz `BuyerRegisterParams`
- [x] 2.6 Agregar interfaz `MissingField` y clase `MissingFieldsError`
- [x] 2.7 Agregar interfaz `BuyerProfileUpdateParams`
- [x] 2.8 Agregar interfaz `WishlistItem`
- [x] 2.9 Exportar constante `BUYER_AUTH_ERRORS`

## 3. fetchRegistrationForm

- [x] 3.1 Implementar `fetchRegistrationForm(config, website): Promise<RegistrationForm>`
- [x] 3.2 Test: devuelve `RegistrationForm` con `steps` y `mode`
- [x] 3.3 Test: lanza error si la API responde con error

## 4. registerBuyer — actualización

- [x] 4.1 Cambiar el tercer parámetro de `{ email, password, fullName? }` a `BuyerRegisterParams`
- [x] 4.2 Mapear campos camelCase del SDK a snake_case del body de la API
      (`fullName` → `full_name`, `docType` → `doc_type`, `birthDate` → `birth_date`, etc.)
- [x] 4.3 Parsear error 422 con `MISSING_REQUIRED_FIELDS` y lanzar `MissingFieldsError`
- [x] 4.4 Test: acepta solo `email` y `password` (compatibilidad hacia atrás)
- [x] 4.5 Test: acepta todos los campos de `BuyerRegisterParams`
- [x] 4.6 Test: lanza `MissingFieldsError` cuando la API devuelve MISSING_REQUIRED_FIELDS
- [x] 4.7 Test: lanza error con status 409 cuando el email ya está registrado

## 5. updateBuyerProfile

- [x] 5.1 Implementar `updateBuyerProfile(config, website, params): Promise<BuyerProfile>`
- [x] 5.2 Mapear campos camelCase a snake_case para el PATCH body
- [x] 5.3 Enviar solo los campos incluidos en `params` (omitir undefined)
- [x] 5.4 Test: devuelve el perfil actualizado
- [x] 5.5 Test: lanza error si el token es inválido (401)

## 6. refreshBuyerToken

- [x] 6.1 Implementar `refreshBuyerToken(config, website, params): Promise<BuyerSession>`
- [x] 6.2 Test: devuelve nueva `BuyerSession`
- [x] 6.3 Test: lanza error 401 si el refresh token está expirado

## 7. Forgot / Reset Password

- [x] 7.1 Implementar `forgotPassword(config, website, params): Promise<void>`
- [x] 7.2 Test: resuelve sin error aunque el email no exista
- [x] 7.3 Implementar `resetPassword(config, params): Promise<void>`
- [x] 7.4 Test: lanza error con `RESET_TOKEN_INVALID` en token inválido
- [x] 7.5 Test: resuelve correctamente con token válido

## 8. Email Verification

- [x] 8.1 Implementar `verifyEmail(config, params): Promise<void>`
- [x] 8.2 Test: lanza error con `VERIFY_TOKEN_INVALID` en token inválido
- [x] 8.3 Implementar `resendVerification(config, params): Promise<void>`
- [x] 8.4 Test: lanza error con `EMAIL_ALREADY_VERIFIED` si ya verificó

## 9. Wishlist

- [x] 9.1 Implementar `fetchWishlist(config, website, params): Promise<WishlistItem[]>`
- [x] 9.2 Test: devuelve array vacío si no hay items
- [x] 9.3 Test: devuelve items del wishlist
- [x] 9.4 Implementar `addToWishlist(config, website, params): Promise<WishlistItem>`
- [x] 9.5 Test: devuelve el item creado
- [x] 9.6 Test: es idempotente (devuelve item existente si ya estaba)
- [x] 9.7 Implementar `removeFromWishlist(config, website, params): Promise<void>`
- [x] 9.8 Test: resuelve en 204
- [x] 9.9 Test: lanza error 404 si el item no existía

## 10. Server-side helpers actualizados / nuevos

- [x] 10.1 Actualizar `processBuyerRegister` para aceptar `BuyerRegisterParams & { next? }`
- [x] 10.2 Implementar `processRefreshToken(env, params): Promise<{ access_token, refresh_token }>`
- [x] 10.3 Implementar `processForgotPassword(env, params): Promise<void>`
- [x] 10.4 Implementar `processResetPassword(env, params): Promise<void>`
- [x] 10.5 Implementar `processVerifyEmail(env, params): Promise<void>`

## 11. Exports

- [x] 11.1 Verificar que todos los tipos e interfaces nuevas estén exportados
- [x] 11.2 Verificar que `BUYER_AUTH_ERRORS` esté exportado
- [x] 11.3 Verificar que `MissingFieldsError` esté exportado como clase (no solo tipo)

## 12. Build y compatibilidad

- [x] 12.1 `pnpm --filter storefront-core build` pasa sin errores ni warnings
- [x] 12.2 `pnpm --filter storefront-core test` — todos los tests pasan
- [x] 12.3 Ninguna firma existente fue rota (revisar manualmente: `registerBuyer`, `loginBuyer`,
      `logoutBuyer`, `fetchBuyerProfile`, cart functions, order functions, address functions)
- [x] 12.4 El `index.d.ts` generado exporta todos los tipos nuevos

## 13. Documentación JSDoc

- [x] 13.1 Agregar JSDoc a `fetchRegistrationForm` con descripción y ejemplo de uso en Astro
- [x] 13.2 Agregar JSDoc a `registerBuyer` documentando el cambio de parámetros
- [x] 13.3 Agregar JSDoc a `MissingFieldsError` explicando cómo usarlo para mostrar errores por campo
- [x] 13.4 Agregar JSDoc a `refreshBuyerToken` con el patrón recomendado de middleware
- [x] 13.5 Agregar JSDoc a `addToWishlist` documentando la idempotencia
