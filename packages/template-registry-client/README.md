# @proxima-io/template-registry-client

Cliente HTTP para la API de templates y websites de Proxima.

> **Paquete interno.** Usado por el CLI `@proxima-io/templateizer`. No necesitas instalarlo en tu storefront — instala el CLI directamente.

## Instalación

```bash
# Solo si construyes scripts o pipelines CI propios sobre la API de Proxima
pnpm add @proxima-io/template-registry-client
```

## `WebsiteDeployClient`

Despliega section types y scaffolding de páginas a un website específico de un cliente.

```ts
import { WebsiteDeployClient, WebsiteDeployClientError } from '@proxima-io/template-registry-client';

const client = new WebsiteDeployClient({
  apiUrl: 'https://api.proxima.io',
  serviceKey: 'pxa_live_...',
});

try {
  const result = await client.deploy('mitienda.proxima.app', manifest, { force: false });

  console.log(result.website);           // { id, domain }
  console.log(result.section_types);    // { created, updated, unchanged }
  console.log(result.pages);            // { created, scaffolded, skipped }
  console.log(result.warnings);         // string[]

} catch (err) {
  if (err instanceof WebsiteDeployClientError) {
    if (err.status === 409 && err.breakingChanges?.length) {
      // Re-deploy con force: true para aplicar breaking changes
    }
  }
}
```

### `WebsiteDeployClientError`

```ts
err.status          // HTTP status code (404, 403, 409, 422…)
err.message         // Mensaje de error
err.responseText    // Respuesta raw del servidor
err.breakingChanges // Array de breaking changes detectados (solo en 409)

// Cada breaking change:
{
  section_type: string;
  attribute: string;
  change: string;   // e.g. "type_changed", "renamed"
  from: string;
  to: string;
}
```

## `TemplateRegistryClient`

Gestiona templates en el registro de Proxima (para el Marketplace).

```ts
import { TemplateRegistryClient } from '@proxima-io/template-registry-client';

const client = new TemplateRegistryClient({
  apiUrl: 'https://api.proxima.io',
  token: process.env.PROXIMA_API_TOKEN,
});

// Buscar template existente
const template = await client.findTemplate({ templateKey: 'my-template', slug: 'my-slug' });

// Crear o actualizar
const created = await client.createTemplate(payload);
const updated = await client.updateTemplate(template.id, payload);

// Publicar
const published = await client.publishTemplate(template.id);

// Verificar visibilidad en catálogo
const visible = await client.isVisibleInCatalog(template.id);
```

### `WebsiteTemplateRecord`

Tipo que representa un template en el registro:

```ts
import type { WebsiteTemplateRecord } from '@proxima-io/template-registry-client';

{
  id: string;
  template_key: string;
  slug: string;
  name: string;
  publication_status: 'draft' | 'published';
  deployment_config: Record<string, unknown>;
}
```

## Relación con otros paquetes

```
templateizer (CLI)
  └── usa template-registry-client para register, deploy, publish, status
  └── usa WebsiteDeployClient para website-deploy
```
