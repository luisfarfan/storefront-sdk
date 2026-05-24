---
name: create-storefront
description: >
  Crear un nuevo proyecto de storefront Astro conectado a Proxima desde cero.
  Usar cuando el usuario quiere: "crear un storefront", "nuevo website", "empezar
  un storefront para un cliente", "inicializar un proyecto Proxima".
---

# Skill: Crear un storefront nuevo

Guía al usuario para crear un proyecto Astro completo conectado a la API de Proxima.

**Prerequisitos que el usuario debe tener antes de empezar:**
- Node.js 22+ y pnpm 9+
- Un website ya creado en el admin de Proxima (el equipo de Proxima lo crea)
- `PROXIMA_SERVICE_KEY` (token entregado por el equipo de Proxima)
- `PROXIMA_DOMAIN` (dominio asignado al website, e.g. `mitienda.proxima.app`)

---

## Paso 1 — Recopilar información

Antes de crear nada, pregunta al usuario con **AskUserQuestion**:

1. **¿Cómo se llama el proyecto?** (nombre del directorio, e.g. `mi-tienda`)
2. **¿Tienen ya el `PROXIMA_DOMAIN` y `PROXIMA_SERVICE_KEY`?** Si no los tienen, detener aquí — el website debe existir en el admin primero.
3. **¿Partir del starter o desde cero?** — Starter = recomendado, contiene todo pre-configurado.

---

## Paso 2A — Partir del starter (recomendado)

```bash
# Desde la raíz de proxima-storefront-sdk
cp -r examples/storefront-starter <nombre-proyecto>
cd <nombre-proyecto>
pnpm install
```

El starter incluye:
- `src/pages/[...path].astro` — catch-all que llama `fetchProximaComposition`
- `src/sections/index.ts` — SECTION_MAP vacío listo para añadir secciones
- `src/lib/proxima.ts` — configuración del SDK
- `proxima.website.json` — manifiesto de ejemplo con 6 section types y 5 páginas
- `.env.example` — variables de entorno documentadas

### Configurar el .env

```bash
cp .env.example .env
```

Editar `.env` con los valores reales:

```env
PROXIMA_API_URL=https://api.proxima.io
PROXIMA_DOMAIN=<dominio-del-cliente>        # e.g. tienda-deportes.proxima.app (templateizer)
PROXIMA_WEBSITE_DOMAIN=<mismo-dominio>      # alias usado por storefront-core
PROXIMA_SERVICE_KEY=pxa_live_...            # scope cms:websites:write
PUBLIC_PROXIMA_API_URL=https://api.proxima.io
```

### Verificar que conecta con la API

```bash
pnpm dev
# Abrir http://localhost:4321
```

Si devuelve 404 o página vacía: el website existe pero no tiene secciones aún — eso es normal, se resuelve en el deploy.

---

## Paso 2B — Desde cero (avanzado)

Solo si el usuario tiene razones para no usar el starter.

```bash
pnpm create astro@latest <nombre> -- --template minimal --typescript strict
cd <nombre>
pnpm add @proxima-io/storefront-core @proxima-io/storefront-cms @proxima-io/storefront-builder-sdk @proxima-io/storefront-commerce
```

**`astro.config.mjs`**:
```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
```

**`src/lib/proxima.ts`**:
```ts
import { fetchProximaWebsite } from '@proxima-io/storefront-core';

export const proximaConfig = {
  baseUrl:    import.meta.env.PROXIMA_API_URL,
  domain:     import.meta.env.PROXIMA_DOMAIN,
  serviceKey: import.meta.env.PROXIMA_SERVICE_KEY,
};

export async function getWebsite() {
  return fetchProximaWebsite(proximaConfig);
}
```

**`src/sections/index.ts`**:
```ts
// Importar aquí cada sección que implementes
export const SECTION_MAP: Record<string, any> = {};
```

**`src/pages/[...path].astro`**:
```astro
---
import { fetchProximaComposition } from '@proxima-io/storefront-core';
import { getWebsite, proximaConfig } from '../lib/proxima';
import { SECTION_MAP } from '../sections';

const website  = await getWebsite();
const path     = '/' + (Astro.params.path ?? '');

let composition;
try {
  composition = await fetchProximaComposition({ ...proximaConfig, path }, website);
} catch (e: any) {
  if (e.status === 404) return Astro.redirect('/404');
  throw e;
}
---
<!doctype html>
<html lang={website.locale}>
  <head>
    <meta charset="UTF-8" />
    <title>{composition.seo?.meta_title ?? website.name}</title>
    <meta name="description" content={composition.seo?.meta_description ?? ''} />
  </head>
  <body>
    {composition.sections.map(section => {
      const Component = SECTION_MAP[section.type];
      return Component
        ? <Component section={section} website={website} composition={composition} />
        : null;
    })}
  </body>
</html>
```

**`proxima.website.json`** mínimo:
```json
{
  "schema_version": "1.0",
  "section_types": [],
  "pages": []
}
```

---

## Paso 3 — Personalizar el manifiesto

Editar `proxima.website.json` para que refleje las secciones reales del cliente.

### Estructura de un section type

```json
{
  "key": "hero",
  "label": "Hero Principal",
  "category": "content",
  "attribute_schema": [
    {
      "name": "image",
      "label": "Imagen de fondo",
      "type": "image",
      "is_required": true,
      "order": 1
    },
    {
      "name": "headline",
      "label": "Título",
      "type": "text",
      "localizable": true,
      "order": 2
    },
    {
      "name": "cta",
      "label": "Botón CTA",
      "type": "link",
      "order": 3
    }
  ]
}
```

**Tipos de atributos disponibles:**

| type | Para qué |
|------|----------|
| `text` | Texto plano corto |
| `rich_text` | Texto con formato HTML |
| `image` | URL de imagen |
| `boolean` | Checkbox (true/false) |
| `number` | Número (entero o decimal) |
| `link` | URL + label |
| `object` | Sub-objeto con campos propios |
| `array` | Lista de items (usar `config.item_fields`) |
| `smart_collection_id` | Query dinámica (productos, categorías, etc.) |

**Builder (`help_text` / `options`):** ver [`docs/07-cms-attribute-schema.md`](../../docs/07-cms-attribute-schema.md). El manifiesto del website define el schema; deploy con `website-deploy`.

### Estructura de una página

**Página estática** (path fijo):
```json
{
  "resolver_kind": "content_page",
  "path": "/",
  "label": "Home",
  "scaffold_sections": [
    { "section_type": "header", "order": 1  },
    { "section_type": "hero",   "order": 2  },
    { "section_type": "footer", "order": 99 }
  ]
}
```

**Página dinámica** (aplica a todas las URLs de ese tipo):
```json
{
  "resolver_kind": "product_detail",
  "label": "Detalle de Producto",
  "scaffold_sections": [
    { "section_type": "header", "order": 1  },
    { "section_type": "footer", "order": 99 }
  ]
}
```

**resolver_kinds disponibles:**
- `content_page` — páginas estáticas (requiere `path`)
- `product_detail` — detalle de producto
- `category_detail` — categoría
- `brand_detail` — marca
- `search` — búsqueda
- `product_list` — listado de productos

---

## Paso 4 — Implementar las secciones en Astro

Por cada section type en `proxima.website.json`, crear el componente Astro:

```astro
<!-- src/sections/HeroSection.astro -->
---
interface Props {
  section: {
    type: string;
    attributes: {
      image?:    { url: string };
      headline?: string;
      cta?:      { label: string; url: string };
    };
  };
}
const { section } = Astro.props;
const { image, headline, cta } = section.attributes;
---
<section class="hero">
  {image && <img src={image.url} alt={headline ?? ''} />}
  {headline && <h1>{headline}</h1>}
  {cta && <a href={cta.url}>{cta.label}</a>}
</section>
```

Registrar en `src/sections/index.ts`:
```ts
import HeroSection from './HeroSection.astro';

export const SECTION_MAP: Record<string, any> = {
  hero: HeroSection,
  // añadir el resto aquí
};
```

**Regla:** el key en `SECTION_MAP` debe coincidir exactamente con el `key` en `proxima.website.json`.

---

## Paso 5 — Deploy a Proxima

El deploy sube **schemas** (`section_types`, `shell_sections`) y crea páginas vacías si faltan. **No** sube catálogo ni contenido editorial — eso es seed o edición en Builder.

```bash
# Ver qué se enviará sin hacer la llamada
npx proxima-templateizer website-deploy . --dry-run

# Deploy real (desde la raíz del proyecto, donde está proxima.website.json)
npx proxima-templateizer website-deploy .

# Breaking changes
npx proxima-templateizer website-deploy . --force
```

En monorepo **proxima-storefronts** (app `214store`): `npm run manifest:deploy` tras configurar `.env`. Contenido demo local: `proxima-api/scripts/seed_214store_website.py` → luego deploy. Ver `apps/214store/docs/DEPLOY.md`.

Output esperado:
```
✓ Connected to tienda-deportes.proxima.app

Section types
  + created  hero
  + created  header
  + created  footer
  ...

Pages
  + created  /  →  scaffolded [header, hero, footer]
  ...

✓ Deploy completed
```

Después del deploy, el comercio puede abrir el Builder y ver las secciones disponibles con su estructura inicial.

---

## Checklist final

- [ ] `.env` tiene `PROXIMA_API_URL`, `PROXIMA_DOMAIN`, `PROXIMA_SERVICE_KEY`
- [ ] El website existe en el admin de Proxima con ese dominio exacto
- [ ] `proxima.website.json` tiene todos los section types implementados
- [ ] Cada key en `section_types` coincide con su componente en `SECTION_MAP`
- [ ] Cada `section_type` en `scaffold_sections` existe en `section_types`
- [ ] `content_page` tiene `path`, los resolver_kind dinámicos no llevan path
- [ ] `templateizer website-deploy --dry-run` muestra el payload esperado
- [ ] `templateizer website-deploy` completa sin errores

---

## Errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `404 — Website not found` | `PROXIMA_DOMAIN` no coincide con el dominio en el admin | Verificar dominio exacto en el admin |
| `403 — Not authorized` | El `business_id` del service key no corresponde a este website | Pedir al equipo de Proxima la key correcta |
| `409 — Breaking changes` | Se cambió el `type` de un atributo ya deployado | `templateizer website-deploy --force` (con cuidado) |
| `422 — content_page requires path` | `resolver_kind: "content_page"` sin `path` | Añadir `"path": "/ruta"` al objeto de página |
| `422 — section_type not declared` | `scaffold_sections` referencia un key no listado en `section_types` | Agregar el section type a la lista |

---

## Próximos pasos después de crear el storefront

1. Implementar todas las secciones en Astro (ver skill `add-section`)
2. Configurar el Builder para preview en tiempo real (ver `docs/06-builder-integration.md`)
3. Añadir commerce features — smart collections, carrito, etc. (ver `docs/07-commerce.md`)
4. Configurar CI/CD para deploy automático en cada push
