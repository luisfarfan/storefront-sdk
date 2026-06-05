# Spec: Profile, Session & Token Refresh

## BuyerProfile — actualización

```typescript
interface BuyerProfile {
  id: number;
  email: string;
  business_id: string;
  full_name: string | null;
  phone: string | null;
  doc_type: number | null;           // 1=DNI 2=CE 3=Pasaporte 6=RUC
  doc_number: string | null;
  birth_date: string | null;         // "YYYY-MM-DD"
  newsletter_subscribed: boolean;
  avatar_url: string | null;
  metadata: Record<string, any>;     // campos custom configurados por el comercio
  registration_source: string;       // "organic" | "google_ads" | etc.
  last_login_at: string | null;      // ISO datetime
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

Los campos nuevos son todos opcionales en la respuesta (pueden ser null). No es breaking change
para código que ya destructura solo `{ email, full_name, is_active }`.

---

## fetchBuyerProfile — sin cambios en firma

```typescript
fetchBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  params: { token: string }
): Promise<BuyerProfile>
```

Solo cambia el tipo de retorno para incluir los campos nuevos.

---

## updateBuyerProfile — nueva función

### Endpoint
```
PATCH /api/v1/store/me/profile
Headers: Authorization: Bearer <token>, X-Business-ID
```

### Tipo

```typescript
interface BuyerProfileUpdateParams {
  fullName?: string | null;
  phone?: string | null;
  docType?: number | null;
  docNumber?: string | null;
  birthDate?: string | null;
  newsletterSubscribed?: boolean;
  avatarUrl?: string | null;
  password?: string;   // si se incluye, cambia la contraseña
}
```

### Firma

```typescript
updateBuyerProfile(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { token: string } & BuyerProfileUpdateParams
): Promise<BuyerProfile>
```

### Comportamiento
- Solo los campos incluidos en el payload se actualizan (partial update).
- Si se incluye `password`, el backend lo hashea y lo guarda. El token actual sigue siendo válido.
- Devuelve el perfil actualizado completo.
- Lanza `{ status, data }` si la API responde con error.

---

## refreshBuyerToken — nueva función

### Endpoint
```
POST /api/v1/store/auth/refresh?refresh_token=<token>
Headers: X-Business-ID
```

### Firma

```typescript
refreshBuyerToken(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { refreshToken: string }
): Promise<BuyerSession>
```

### Comportamiento
- Devuelve una nueva `BuyerSession` con `access_token` fresco.
- Si el refresh token está expirado o revocado, lanza `{ status: 401 }`.
- El caller (Astro middleware) debe actualizar la cookie con el nuevo `access_token`.

### processRefreshToken — server-side helper (nueva)

```typescript
processRefreshToken(
  env: BuyerServerEnv,
  params: { refreshToken: string }
): Promise<{ access_token: string; refresh_token: string | null }>
```

Combina `fetchProximaWebsite` + `refreshBuyerToken`. Para usar en el Astro middleware
que detecta tokens expirados.

---

## Patron recomendado para Astro middleware

```
1. Leer cookie buyer_token
2. Si no existe → continuar sin sesión
3. Si existe → intentar fetchBuyerProfile
4. Si devuelve 401 → intentar processRefreshToken con refresh_token cookie
5. Si refresh OK → actualizar cookie buyer_token y continuar
6. Si refresh falla → limpiar ambas cookies y continuar sin sesión
```

Este flujo no vive en el SDK — es orientación para el desarrollador del storefront.
El SDK provee los primitivos; el middleware es responsabilidad del template.
