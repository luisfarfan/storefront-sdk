# Design: Customer Auth & Profile SDK

## Decisiones arquitectónicas

### AD-001: Todo vive en `storefront-core/src/index.ts`
El SDK usa el patrón "un archivo por paquete". No se crean archivos nuevos ni sub-módulos.
Todas las adiciones van al final del `index.ts` existente, agrupadas por dominio con comentarios
de sección — igual que los bloques actuales de Cart, Orders, Address Book, Analytics.

### AD-002: No hay breaking changes en firmas existentes
`registerBuyer` actualmente acepta `{ email, password, fullName? }`. El nuevo parámetro es
`BuyerRegisterParams` que extiende eso con campos opcionales. El tercer argumento cambia de
tipo pero es retrocompatiblemente aditivo — cualquier código que pase `{ email, password }`
sigue funcionando.

### AD-003: El formulario de registro es un tipo de solo lectura
`RegistrationForm` y sus sub-tipos son interfaces de respuesta de la API. No se crean
builders ni validadores en el SDK — eso es responsabilidad del storefront o de una librería
de formularios. El SDK solo fetchea y tipea.

### AD-004: Manejo de errores — patrón existente
Se sigue el patrón ya establecido en el SDK:
```
throw Object.assign(new Error(`Request failed: ${status}`), { status, data: body })
```
Para el caso especial de `MISSING_REQUIRED_FIELDS` (422 del register), se agrega un tipo
`MissingFieldsError` que el storefront puede usar para renderizar errores por campo.
La función lanza igual — es el caller quien hace `instanceof` o inspecciona `error.data`.

### AD-005: Wishlist — sin caché local
Las funciones de wishlist son stateless. No mantienen estado en el SDK. Si el storefront
necesita estado reactivo (ej: contador en el header), lo implementa con stores de Nano Stores
o similar. El SDK solo provee los fetch primitivos.

### AD-006: Server-side helpers — patrón `process*`
Los helpers que combinan `fetchProximaWebsite` + llamada a la API se nombran `process*`
y son para Astro API routes (`src/pages/api/`). Las funciones client-side puras (sin
`fetchProximaWebsite`) se usan desde componentes con `client:*` directives.

### AD-007: Token refresh — no auto-retry
`refreshBuyerToken` es una función explícita. El SDK no implementa interceptors ni
retry automático. Es responsabilidad del Astro middleware o del API route de la sesión
llamar a refresh cuando detecta un 401. Esto mantiene el SDK sin estado y predecible.

### AD-008: `AddressInput` necesita campos de geolocalización
El tipo existente `AddressInput` no tiene `latitude`, `longitude`, `geocoding_source`.
Se actualiza el tipo para incluirlos como opcionales. No es breaking change.

## Riesgos

- **Tamaño del archivo**: `index.ts` ya tiene 883 líneas. Con estas adiciones llega a ~1200.
  Aceptable por ahora. Si supera 1500 líneas, evaluar split en archivos internos con re-export.

- **`BuyerProfile.metadata`**: Es `Record<string, any>`. Los campos custom que el comercio
  configuró van ahí. El storefront tiene que saber qué keys esperar — no hay tipado fuerte.
  Esto es inherente al diseño del sistema (campos dinámicos por comercio).
