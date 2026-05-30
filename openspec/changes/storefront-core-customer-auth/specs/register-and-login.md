# Spec: Register & Login

## registerBuyer — actualización

### Endpoint
```
POST /api/v1/store/auth/register
Headers: X-Business-ID, Content-Type: application/json
```

### Tipo nuevo: parámetros de registro

```typescript
/** Dirección enviada durante el registro (opcional, si el comercio la pide). */
interface AddressInRegistration {
  line1: string;
  line2?: string | null;
  reference?: string | null;
  ubigeo_code?: string | null;       // 6 dígitos, ej: "150101"
  latitude?: number | null;
  longitude?: number | null;
  geocoding_source?: string | null;  // "google_maps" | "ubigeo_centroid" | "manual"
}

/** Todos los campos posibles para POST /store/auth/register. */
interface BuyerRegisterParams {
  email: string;
  password: string;
  // Campos opcionales — el comercio decide cuáles son required
  fullName?: string | null;
  phone?: string | null;
  docType?: number | null;           // 1=DNI 2=CE 3=Pasaporte 6=RUC
  docNumber?: string | null;
  birthDate?: string | null;         // ISO date "YYYY-MM-DD"
  newsletterSubscribed?: boolean;
  registrationSource?: string;       // default "organic"
  metadata?: Record<string, any>;    // campos custom del comercio
  address?: AddressInRegistration | null;
}
```

### Tipo nuevo: error de campos faltantes

```typescript
/** Detalle de un campo requerido que faltó en el registro. */
interface MissingField {
  field: string;
  msg: string;  // siempre "FIELD_REQUIRED"
}

/**
 * Thrown cuando la API devuelve 422 con "MISSING_REQUIRED_FIELDS:[...]".
 * El storefront puede usar `error.missingFields` para marcar qué campos faltan.
 */
class MissingFieldsError extends Error {
  status: 422;
  missingFields: MissingField[];
}
```

### Firma actualizada

```typescript
registerBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: BuyerRegisterParams
): Promise<BuyerSession>
```

### Comportamiento
- Si la API devuelve 409: lanza error con `status: 409` y `data.detail: "Email already registered..."`.
- Si la API devuelve 422 con `MISSING_REQUIRED_FIELDS`: lanza `MissingFieldsError` con los campos
  parseados para que el storefront pueda mostrar errores por campo.
- Si la API devuelve 422 con `DOC_TYPE_REQUIRED_WITH_DOC_NUMBER`: lanza error estándar con `status: 422`.
- En éxito devuelve `BuyerSession` con `access_token` y `refresh_token`.

### processBuyerRegister — actualización (server-side helper)

```typescript
processBuyerRegister(
  env: BuyerServerEnv,
  params: BuyerRegisterParams & { next?: string }
): Promise<{ access_token: string; refresh_token?: string; next: string }>
```

Igual que antes pero acepta todos los campos de `BuyerRegisterParams` y los pasa a `registerBuyer`.

---

## loginBuyer — sin cambios en firma

La firma actual es correcta. No cambia nada.

```typescript
loginBuyer(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">,
  params: { email: string; password: string }
): Promise<BuyerSession>
```

### Comportamiento existente (documentar, no cambiar)
- 401: lanza `{ status: 401 }`. El storefront muestra "Email o contraseña incorrectos".
- 200: devuelve `BuyerSession`.

---

## BuyerSession — actualización menor

```typescript
interface BuyerSession {
  access_token: string;
  refresh_token: string | null;  // puede ser null en algunos flujos sociales
  token_type: string;
}
```

`refresh_token` ya existe en el tipo actual como `refresh_token?: string | null`. Solo documentar
que es `null` posible, no breaking change.
