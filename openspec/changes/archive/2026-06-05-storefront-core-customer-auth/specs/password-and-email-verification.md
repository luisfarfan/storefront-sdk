# Spec: Forgot/Reset Password & Email Verification

## forgotPassword — nueva función

### Endpoint
```
POST /api/v1/store/auth/forgot-password
Headers: X-Business-ID, Content-Type: application/json
Body: { email }
```

### Firma

```typescript
forgotPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string }
): Promise<void>
```

### Comportamiento
- Siempre resuelve sin error, aunque el email no exista (por seguridad, el backend no confirma).
- El storefront debe mostrar siempre el mensaje "Si el email existe, recibirás un enlace".
- No lanza error en ningún caso de respuesta esperada.

### processForgotPassword — server-side helper (nueva)

```typescript
processForgotPassword(
  env: BuyerServerEnv,
  params: { email: string }
): Promise<void>
```

---

## resetPassword — nueva función

### Endpoint
```
POST /api/v1/store/auth/reset-password
Headers: Content-Type: application/json
Body: { token, new_password }
```

### Firma

```typescript
resetPassword(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string; newPassword: string }
): Promise<void>
```

### Comportamiento
- `token` viene del query param de la URL del email de recuperación: `/reset-password?token=xxx`
- Si el token es inválido o expirado: lanza `{ status: 400, data.detail: "RESET_TOKEN_INVALID" }`.
- Si el token ya fue usado (contraseña cambiada después de emitir el token): mismo error.
- En éxito, todas las sesiones activas del cliente son revocadas. El storefront debe
  redirigir al login con un mensaje de "Contraseña actualizada, inicia sesión de nuevo".

### processResetPassword — server-side helper (nueva)

```typescript
processResetPassword(
  env: BuyerServerEnv,
  params: { token: string; newPassword: string }
): Promise<void>
```

---

## verifyEmail — nueva función

### Endpoint
```
POST /api/v1/store/auth/verify-email
Headers: Content-Type: application/json
Body: { token }
```

### Firma

```typescript
verifyEmail(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<void>
```

### Comportamiento
- `token` viene del query param: `/verify-email?token=xxx`
- Si el token es inválido o expirado: lanza `{ status: 400, data.detail: "VERIFY_TOKEN_INVALID" }`.
- En éxito: el email queda marcado como verificado. El storefront puede mostrar un mensaje
  de confirmación y redirigir a la cuenta.

### processVerifyEmail — server-side helper (nueva)

```typescript
processVerifyEmail(
  env: BuyerServerEnv,
  params: { token: string }
): Promise<void>
```

---

## resendVerification — nueva función

### Endpoint
```
POST /api/v1/store/auth/resend-verification
Headers: Authorization: Bearer <token>
```

### Firma

```typescript
resendVerification(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<void>
```

### Comportamiento
- Requiere que el cliente esté autenticado.
- Si el email ya fue verificado: lanza `{ status: 400, data.detail: "EMAIL_ALREADY_VERIFIED" }`.
- En éxito: el backend envía el email de verificación. El storefront muestra confirmación.

---

## Errores de token — constantes exportadas

Para que el storefront pueda hacer `if (error.data?.detail === ERRORS.RESET_TOKEN_INVALID)`:

```typescript
export const BUYER_AUTH_ERRORS = {
  RESET_TOKEN_INVALID: "RESET_TOKEN_INVALID",
  VERIFY_TOKEN_INVALID: "VERIFY_TOKEN_INVALID",
  EMAIL_ALREADY_VERIFIED: "EMAIL_ALREADY_VERIFIED",
  EMAIL_TAKEN: "Email already registered in this store",
  MISSING_REQUIRED_FIELDS: "MISSING_REQUIRED_FIELDS",
} as const;
```
