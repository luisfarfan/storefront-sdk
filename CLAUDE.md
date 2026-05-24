# proxima-storefront-sdk — Contexto para agentes de IA

Este documento es el punto de entrada para cualquier agente de IA que trabaje en este repositorio.
Lee esto primero. Luego consulta los skills específicos según la tarea.

---

## ¿Qué es este repositorio?

Monorepo TypeScript (pnpm workspaces + Turborepo) que contiene:
- Los paquetes SDK para storefronts Astro que se conectan a la API de Proxima
- El CLI `templateizer` para gestionar templates y hacer deploys
- El ejemplo `storefront-starter` como plantilla de inicio
- Documentación en `docs/`

**Lo que este repo NO es**: no contiene la API de Proxima (eso está en `proxima-api`).

---

## Mapa del repositorio

```
proxima-storefront-sdk/
├── packages/
│   ├── storefront-core/          # HTTP client principal — fetchProximaWebsite, fetchProximaComposition, etc.
│   ├── storefront-cms/           # Normalización de secciones, tenant resolution, preview
│   ├── storefront-commerce/      # Tipos de commerce (DeliveryMode, ResolverKind, etc.)
│   ├── storefront-builder-sdk/   # Bridge postMessage con el Builder visual
│   ├── template-schema/          # Schema Zod para proxima.template.json
│   ├── template-registry-client/ # HTTP client para el template registry admin
│   └── templateizer/             # CLI: website-deploy, validate, register, publish
├── examples/
│   └── storefront-starter/       # Proyecto Astro de ejemplo completamente funcional
├── docs/
│   ├── 01-mental-model.md        # LEER PRIMERO — jerarquía Website→Pages→Sections→Attributes
│   ├── 02-quick-start.md         # Setup en 10 min
│   ├── 03-architecture.md        # Organización de archivos de un storefront
│   ├── 04-sections-and-attributes.md
│   ├── 05-smart-collections.md
│   ├── 06-builder-integration.md
│   ├── 07-commerce.md
│   ├── 08-template-authoring.md
│   └── 09-deploy.md              # LEER para entender website-deploy
└── openspec/                     # Propuestas de cambio en formato OpenSpec
```

---

## Conceptos fundamentales

### La jerarquía de datos

```
Website
  └── Pages  (rutas URL, cada una con resolver_kind)
        └── Sections  (bloques visuales, tipo = section_type key)
              └── Attributes  (campos editables por el comercio en el Builder)
```

### Dos tipos de manifiestos

| Archivo | Propósito | Comando |
|---------|-----------|---------|
| `proxima.website.json` | Deploy de section types + pages a un website de cliente | `templateizer website-deploy` |
| `proxima.template.json` | Publicar template reutilizable en el Marketplace | `templateizer register/publish` |

No confundirlos. Un storefront de cliente solo necesita `proxima.website.json`.

### Tipos de páginas (resolver_kind)

| resolver_kind | ¿Tiene path fijo? | Para qué |
|---|---|---|
| `content_page` | Sí — path requerido (e.g. `/`, `/nosotros`) | Páginas estáticas |
| `product_detail` | No — aplica a todas las URLs `/producto/*` | Detalle de producto |
| `category_detail` | No | Listado de categoría |
| `brand_detail` | No | Página de marca |
| `search` | No | Búsqueda |
| `product_list` | No | Listado de productos |

### Tipos de atributos

```
text | rich_text | image | boolean | number | link | object | array | smart_collection_id
```

---

## Variables de entorno (todo storefront necesita esto)

```env
PROXIMA_API_URL=https://api.proxima.io        # URL base de la API
PROXIMA_DOMAIN=mitienda.proxima.app           # Dominio del website (debe existir en el admin)
PROXIMA_SERVICE_KEY=pxa_live_...              # Service key con scope cms:websites:write
PUBLIC_PROXIMA_API_URL=https://api.proxima.io # Igual que PROXIMA_API_URL, expuesto al browser
```

La `PROXIMA_SERVICE_KEY` es un token de service account creado por el equipo de Proxima.
Formato: `pxa_live_...` (producción) o `pxa_test_...` (desarrollo).

---

## Autenticación

El deploy usa **Bearer token** (service key) en el header `Authorization`.
El endpoint valida que el `business_id` del token coincida con el `business_id` del website.

```
POST /api/v1/admin/cms/websites/deploy
Authorization: Bearer pxa_live_xxx
Content-Type: application/json
```

Scopes necesarios: `cms:websites:write`

---

## El endpoint de deploy (API de Proxima)

```
POST /api/v1/admin/cms/websites/deploy
  ?force=false   # true para aplicar breaking changes
```

Payload:
```json
{
  "website_domain": "mitienda.proxima.app",
  "section_types": [ ...WebsiteDeploySectionTypeSchema ],
  "pages":         [ ...WebsiteDeployPageSchema ]
}
```

Respuesta exitosa (200):
```json
{
  "ok": true,
  "website": { "id": "...", "domain": "..." },
  "section_types": { "created": [...], "updated": [...], "unchanged": [...] },
  "pages":         { "created": [...], "scaffolded": {...}, "skipped": {...} },
  "warnings":      [...]
}
```

Errores:
- `404` — website_domain no encontrado
- `403` — service key de otro negocio
- `409` — breaking changes detectados (re-enviar con `?force=true`)
- `422` — validación del payload (path faltante, key no declarado, etc.)

---

## Comandos del CLI

```bash
# Deploy de section types + pages a un website específico
templateizer website-deploy

# Con opciones
templateizer website-deploy --dry-run                    # ver payload sin llamar la API
templateizer website-deploy --force                      # aplicar breaking changes
templateizer website-deploy --service-key pxa_live_xxx   # override de .env

# Validar el proxima.template.json
templateizer validate

# Otros (para template marketplace — no para websites de clientes)
templateizer register
templateizer publish
templateizer deploy
templateizer sync
```

---

## Skills disponibles

Para tareas específicas, consulta los skills en `.claude/skills/`:

| Skill | Cuándo usarlo |
|-------|---------------|
| `create-storefront` | Crear un nuevo proyecto de storefront desde cero |
| `website-deploy` | Ejecutar o debuggear un deploy de website |
| `add-section` | Añadir una nueva sección a un storefront existente |
| `openspec-propose` | Proponer un cambio al SDK/CLI |
| `openspec-apply-change` | Implementar tareas de un OpenSpec |

---

## Reglas importantes para agentes

1. **Nunca modificar `proxima.template.json` cuando el objetivo es un deploy de cliente** — ese archivo es para el marketplace.

2. **El deploy es idempotente** — se puede ejecutar múltiples veces sin miedo. Solo aplica lo que cambió.

3. **`scaffold_sections` nunca sobreescribe** — si la página ya tiene secciones del comercio, el scaffold se ignora.

4. **Breaking changes requieren `--force`** — cambiar el `type` de un atributo o renombrar un atributo (`name`) bloquea el deploy sin `--force`.

5. **El website debe existir previamente** — `templateizer website-deploy` no crea el website. El website lo crea el equipo de Proxima en el admin.

6. **Los keys deben coincidir** — el `key` en `section_types` del manifiesto debe ser idéntico al key en `SECTION_MAP` del storefront y en el `type` de cada `Section` en la BD.

7. **`content_page` siempre necesita `path`** — otros `resolver_kind` no lo llevan.

---

## Packages importantes para leer

- `packages/storefront-core/src/index.ts` — `fetchProximaWebsite`, `fetchProximaComposition`, `ProximaApiConfig`
- `packages/templateizer/src/index.ts` — toda la lógica del CLI incluyendo `websiteDeployCommand`
- `examples/storefront-starter/proxima.website.json` — manifiesto de ejemplo completo
- `examples/storefront-starter/.env.example` — variables de entorno necesarias
