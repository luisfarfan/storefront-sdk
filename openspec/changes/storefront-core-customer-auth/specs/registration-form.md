# Spec: Registration Form — fetchRegistrationForm

## Endpoint
```
GET /api/v1/store/auth/registration-form
Headers: X-Business-ID: <business_id>
```
No requiere autenticación.

## Tipos nuevos

```typescript
/** Un campo resuelto del formulario de registro. */
interface RegistrationFormField {
  name: string;            // "email" | "password" | "full_name" | "phone" | etc.
  label: string;           // label en español listo para mostrar
  type: string;            // "text" | "password" | "phone" | "date" | "select" | "boolean" | "image" | "address" | "custom"
  widget: string;          // "text_input" | "phone_input" | "date_picker" | "select" | "checkbox" | "toggle" | "image_upload" | "ubigeo_selector" | "google_maps_picker" | "manual"
  widget_config: Record<string, any>;  // ej: { zoom: 15 } para google_maps_picker
  required: boolean;
  order: number;
  options: string[] | null;  // solo para widget "select"
}

/** Un paso del formulario (siempre al menos uno). */
interface RegistrationFormStep {
  id: string;
  label: string;
  order: number;
  skippable: boolean;
  fields: RegistrationFormField[];
}

/** Respuesta completa de GET /store/auth/registration-form. */
interface RegistrationForm {
  mode: "single_step" | "multi_step";
  steps: RegistrationFormStep[];
}
```

## Función

```typescript
fetchRegistrationForm(
  config: Pick<ProximaApiConfig, "baseUrl">,
  website: Pick<ProximaWebsiteResponse, "business_id">
): Promise<RegistrationForm>
```

## Comportamiento
- Lanza `{ status, data }` si la API responde con error.
- El campo `email` y `password` siempre están presentes en `steps[0].fields` con `required: true`.
  El storefront no necesita añadirlos manualmente.
- Si el comercio no configuró nada, devuelve un form mínimo con solo email + password.
- Los campos con `widget: "ubigeo_selector"` requieren el componente de ubigeo (cascada de selects).
- Los campos con `widget: "google_maps_picker"` requieren el componente de mapa. El `widget_config.zoom`
  indica el zoom inicial del mapa.

## Uso en Astro (server-side, página de registro)
```
// src/pages/register.astro
const form = await fetchRegistrationForm({ baseUrl: env.apiUrl }, website);
// Pasar `form` como prop a un componente cliente que renderiza el form dinámico
```

## Uso en Astro (client-side, preview reactiva)
No aplica — el form se fetcha en server-side y se pasa como prop.
