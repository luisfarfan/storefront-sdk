# 02 — Quick start

Desde cero hasta un storefront funcionando en ~10 minutos.

---

## Prerequisitos

- Node.js 22+
- pnpm o npm
- Website creado en Proxima (o modo fixtures para demo)
- Service key con scope `cms:websites:write`

---

## Opción A — Golden template (recomendado)

Clona el monorepo [proxima-storefronts](https://github.com/proxima-io/proxima-storefronts) y usa `apps/214store` como referencia, o copia ese app para un nuevo cliente.

```bash
git clone …/proxima-storefronts
cd proxima-storefronts
npm install
cp apps/214store/.env.example apps/214store/.env
# editar PROXIMA_* 
npm run dev:214store
```

---

## Opción B — Proyecto standalone

```bash
pnpm create astro@latest mi-tienda -- --template minimal --typescript strict
cd mi-tienda

pnpm add @proxima-io/storefront-core @proxima-io/storefront-cms \
  @proxima-io/storefront-builder-sdk @proxima-io/storefront-commerce

npm install -g @proxima-io/cli
proxima skills install
```

Configura SSR (`@astrojs/node`), crea `proxima.website.json`, `SectionRenderer`, `SiteLayout` con shell — sigue [03-architecture.md](./03-architecture.md).

Starter de referencia en el SDK: `examples/storefront-starter/` (si existe en tu checkout).

---

## CLI Proxima

```bash
npm install -g @proxima-io/cli

proxima init              # wizard → .proxima/credentials.json
proxima validate          # validar manifiesto (desde app dir o slug en monorepo)
proxima deploy            # subir section_types + pages + shell a la API
proxima skills list       # agent skills para Cursor / Claude
proxima skills install    # instalar en .cursor/skills + .claude/skills
```

En monorepo con varios apps: `proxima list` descubre `apps/*/proxima.website.json`.

---

## Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `PROXIMA_API_URL` | URL base API | ✅ |
| `PROXIMA_WEBSITE_DOMAIN` | Dominio del website (single-tenant) | ✅ |
| `PROXIMA_SERVICE_KEY` | Service key server-side | ✅ |
| `PROXIMA_DATA_MODE` | `fixtures` \| `live` | Opcional |
| `PROXIMA_TEMPLATE_DEMO_DOMAIN` | Dominios demo comma-separated | Solo marketplace preview |

Alias aceptado: `PROXIMA_DOMAIN` = `PROXIMA_WEBSITE_DOMAIN`.

---

## Primer deploy

1. Website debe existir en admin (mismo dominio que `.env`)
2. Tener `proxima.website.json` con `section_types` + `pages` + `shell_sections`
3. Ejecutar:

```bash
proxima init
proxima validate
proxima deploy --dry-run
proxima deploy
```

El deploy **no** sube catálogo ni rellena contenido si el merchant ya editó secciones. Ver [09-deploy.md](./09-deploy.md).

---

## Verificar

- `http://localhost:4325` (o tu port) muestra home con secciones
- Builder: abrir website en admin → se ven section types del manifiesto
- Preview: URL con `?proxima_preview=1` activa inline editing

Si página en blanco en live: falta scaffold o contenido — agregar secciones en Builder o correr seed (dev).

---

## Siguientes pasos

1. [Modelo mental](./01-mental-model.md)
2. [Arquitectura](./03-architecture.md)
3. [Sections](./04-sections-and-attributes.md)
4. [Agent skills](./10-agent-skills.md)
