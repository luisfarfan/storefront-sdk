# @proxima-io/template-schema

Schemas Zod y tipos TypeScript para los manifiestos de Proxima — `proxima.template.json` y `proxima.website.json`.

> **Paquete interno.** Usado por el CLI `@proxima-io/templateizer`. No necesitas instalarlo en tu storefront — instala el CLI directamente.

## Instalación

```bash
# Solo si construyes herramientas sobre los schemas de Proxima
pnpm add @proxima-io/template-schema
```

## Manifiestos soportados

### `proxima.template.json` — Template para el Marketplace

Define un template reutilizable que puede instalarse en múltiples websites desde el Proxima Marketplace.

```ts
import { parseTemplateManifest, validateTemplateManifest } from '@proxima-io/template-schema';
import type { TemplateManifest } from '@proxima-io/template-schema';

// Validación con errores estructurados (no lanza)
const result = validateTemplateManifest(rawJson);
if (!result.success) {
  for (const issue of result.error.issues) {
    console.error(`${issue.path.join('.')}: ${issue.message}`);
  }
}

// Parse con lanzamiento de error (Zod estándar)
const manifest: TemplateManifest = parseTemplateManifest(rawJson);
```

### `proxima.website.json` — Deploy a website específico

Define la estructura que se despliega a un website concreto de un cliente.

```ts
import { validateWebsiteDeployManifest, parseWebsiteDeployManifest } from '@proxima-io/template-schema';
import type { WebsiteDeployManifest } from '@proxima-io/template-schema';

const result = validateWebsiteDeployManifest(rawJson);
if (result.success) {
  const manifest: WebsiteDeployManifest = result.data;
}
```

## Tipos clave

```ts
import type {
  TemplateManifest,
  WebsiteDeployManifest,
} from '@proxima-io/template-schema';
```

### `TemplateManifest`

Tipo completo de `proxima.template.json`. Campos principales:

```ts
{
  template_key: string;           // Identificador único del template
  name: string;
  slug: string;
  category: string;
  section_types: SectionType[];
  pages: TemplatePage[];
  smart_collection_placeholders: SmartCollectionPlaceholder[];
  deployment_config: DeploymentConfig;
}
```

### `WebsiteDeployManifest`

Tipo completo de `proxima.website.json`. Campos principales:

```ts
{
  section_types: SectionType[];
  pages: WebsiteDeployPage[];
  shell_sections?: ShellSection[];
  shell_default_values?: Record<string, Record<string, unknown>>;
  smart_collection_placeholders?: Record<string, SmartCollectionPlaceholder>;
}
```

## Constantes exportadas

```ts
import { attributeTypes, smartCollectionTypes, sensitiveKeys } from '@proxima-io/template-schema';

// attributeTypes — tipos válidos de atributo
// ['text', 'rich_text', 'image', 'boolean', 'number', 'link', 'object', 'array', 'smart_collection_id']

// sensitiveKeys — keys de atributo que el schema rechaza (p.ej. 'password', 'token')
```

## Validaciones que aplica el schema

- Cross-reference: cada `section_type` en `scaffold_sections` debe estar declarado en `section_types`
- `smart_collection_id` no puede ser un ID numérico en templates — debe usar `{"_smart_collection_placeholder": "key"}`
- `content_page` siempre requiere `path`; otros `resolver_kind` no lo llevan
- Keys de atributo sensibles son rechazados
