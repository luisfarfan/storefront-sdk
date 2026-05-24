# 02 — Quick start

Desde cero hasta un storefront funcionando en ~10 minutos.

---

## Prerequisitos

- Node.js 22+
- pnpm 9+
- Una cuenta en Proxima con al menos un Website creado
- Las credenciales de la API

---

## Opción A — Usar el starter (recomendado)

```bash
# Clonar el starter desde el monorepo
cp -r examples/storefront-starter mi-tienda
cd mi-tienda

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
```

Editar `.env`:

```env
PROXIMA_API_URL=https://api.proxima.io     # URL base de la API
PROXIMA_DOMAIN=mitienda.proxima.app        # Tu dominio (o subdominio de desarrollo)
PROXIMA_SERVICE_KEY=sk_live_...            # Service key del tenant
```

```bash
pnpm dev
# → http://localhost:4321
```

---

## Opción B — Proyecto nuevo desde cero

```bash
# Crear proyecto Astro
pnpm create astro@latest mi-tienda -- --template minimal --typescript strict
cd mi-tienda

# Instalar SDK
pnpm add @proxima-io/storefront-core @proxima-io/storefront-cms @proxima-io/storefront-builder-sdk @proxima-io/storefront-commerce
```

Configurar Astro para SSR:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
```

Crear el archivo de configuración del SDK:

```ts
// src/lib/proxima.ts
import { fetchProximaWebsite } from '@proxima-io/storefront-core';

export const proximaConfig = {
  baseUrl: import.meta.env.PROXIMA_API_URL,
  domain:  import.meta.env.PROXIMA_DOMAIN,
  serviceKey: import.meta.env.PROXIMA_SERVICE_KEY,
};

/** Resuelve el website del tenant. Cachear en producción. */
export async function getWebsite() {
  return fetchProximaWebsite(proximaConfig);
}
```

Crear la página catch-all:

```astro
---
// src/pages/[...path].astro
import { fetchProximaComposition } from '@proxima-io/storefront-core';
import { getWebsite, proximaConfig } from '../lib/proxima';
import { SECTION_MAP } from '../sections';

const website = await getWebsite();
const path = '/' + (Astro.params.path ?? '');

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

Crear el section router mínimo:

```ts
// src/sections/index.ts
// Importar componentes a medida que los vayas creando
export const SECTION_MAP: Record<string, any> = {};
```

---

## Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `PROXIMA_API_URL` | URL base de la API. E.g. `https://api.proxima.io` | ✅ |
| `PROXIMA_DOMAIN` | Dominio del storefront. Debe coincidir con el website en el admin | ✅ |
| `PROXIMA_SERVICE_KEY` | Service key del tenant para requests server-side | ✅ |
| `PUBLIC_PROXIMA_API_URL` | Igual que `PROXIMA_API_URL` pero expuesto al cliente (para analytics) | Recomendada |

---

## Verificar que funciona

Con el servidor corriendo, abrir `http://localhost:4321` debería mostrar las secciones
configuradas en el admin para la ruta `/` (home page).

Si ves una página en blanco: el website probablemente no tiene secciones configuradas aún.
Ir al admin → Builder → agregar secciones.

Si ves un error 404: verificar que `PROXIMA_DOMAIN` coincide exactamente con el dominio
del website en el admin de Proxima.

---

## Siguientes pasos

1. [Entender el modelo mental](./01-mental-model.md) — si no lo leíste aún
2. [Arquitectura de archivos](./03-architecture.md) — cómo organizar el proyecto
3. [Crear tus primeras secciones](./04-sections-and-attributes.md)
