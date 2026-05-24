# 09 — Deploy

Cómo subir la estructura de tu storefront a la API de Proxima para que el comercio
pueda empezar a editar su website desde el Builder.

---

## El problema que resuelve

El developer construyó el storefront en Astro: las secciones existen como componentes,
los atributos están definidos en el código. Pero la API de Proxima todavía no sabe
nada de eso.

El comercio abre el Builder y ve **una página en blanco**. No puede agregar secciones
porque la API no sabe qué secciones existen. No puede editar atributos porque la API
no sabe qué campos tiene cada sección.

`templateizer website-deploy` resuelve esto en **un solo comando**.

---

## Dos archivos, dos flujos distintos

El starter incluye dos archivos de manifiesto. Es importante no confundirlos:

| Archivo | Para qué | Comando |
|---------|----------|---------|
| `proxima.website.json` | Deploy a un website específico de un cliente | `templateizer website-deploy` |
| `proxima.template.json` | Publicar en el Proxima Marketplace | `templateizer register/publish` |

**Si estás construyendo para un cliente concreto, solo necesitas `proxima.website.json`.**

---

## Prerequisito: el website debe existir en el admin

El deploy no crea el website — ese paso se hace una sola vez desde el admin de Proxima
(o lo hace el equipo de Proxima al onboardear al comercio).

Lo que el deploy sí hace:
- Registrar los **section types** del storefront en ese website
- Crear las **páginas** definidas y poblarlas con secciones vacías listas para editar

Para verificar que tienes todo lo necesario en el `.env`:

```env
PROXIMA_API_URL=https://api.proxima.io
PROXIMA_DOMAIN=tienda-deportes.proxima.app   # debe coincidir con el website en el admin
PROXIMA_SERVICE_KEY=sk_live_...              # service key del tenant
```

---

## El manifiesto — `proxima.website.json`

Define exactamente lo que el deploy sube a la API.

```json
{
  "schema_version": "1.0",
  "section_types": [...],
  "pages": [...]
}
```

### `section_types`

Cada section type que implementaste en Astro **debe estar aquí**.
El `key` debe coincidir exactamente con el de `SECTION_MAP`.

```json
{
  "key": "hero",
  "label": "Hero Principal",
  "category": "content",
  "attribute_schema": [
    { "name": "image",    "label": "Imagen",   "type": "image", "is_required": true, "order": 1 },
    { "name": "headline", "label": "Título",   "type": "text",  "localizable": true,  "order": 2 },
    { "name": "cta",      "label": "Botón CTA","type": "link",                        "order": 3 }
  ]
}
```

### `pages`

**Páginas estáticas** — tienen `resolver_kind: "content_page"` y un `path` fijo:

```json
{
  "resolver_kind": "content_page",
  "path": "/",
  "label": "Home",
  "scaffold_sections": [
    { "section_type": "header", "order": 1 },
    { "section_type": "hero",   "order": 2 },
    { "section_type": "footer", "order": 99 }
  ]
}
```

**Páginas dinámicas** — aplican a todas las URLs de ese `resolver_kind`.
No llevan `path`:

```json
{
  "resolver_kind": "product_detail",
  "label": "Detalle de Producto",
  "scaffold_sections": [
    { "section_type": "header", "order": 1 },
    { "section_type": "footer", "order": 99 }
  ]
}
```

### `scaffold_sections`

Las secciones que se crean **automáticamente** cuando la página se scaffoldea por
primera vez. El comercio abre el Builder y ve la estructura ya armada.

> Si la página ya existe con secciones del comercio, `scaffold_sections` se ignora
> completamente. Nunca se sobreescribe contenido ya configurado.

---

## Ejecutar el deploy

```bash
# 1. Validar el manifiesto localmente (usa proxima.template.json)
templateizer validate

# 2. Deploy a tu website específico (usa proxima.website.json)
templateizer website-deploy
```

El CLI lee el `.env` del proyecto para autenticarse y determinar el website de destino.

### Flags disponibles

```bash
# Ver qué se enviaría sin hacer la llamada
templateizer website-deploy --dry-run

# Forzar cambios breaking (cambios de tipo, renombres de atributos)
templateizer website-deploy --force

# Sobreescribir credenciales (útil en CI)
templateizer website-deploy --api-url https://api.proxima.io --service-key sk_live_... --domain tienda.proxima.app
```

---

## Output del deploy

```
✓ Connected to tienda-deportes.proxima.app (website #7)

Section types
  + created    category_grid
  + created    search
  ~ updated    hero  (1 attribute changed)
  · unchanged  header, product_grid, footer

Pages
  + created    /  →  scaffolded [header, hero, product_grid, category_grid, footer]
  + created    product_detail  →  scaffolded [header, footer]
  + created    category_detail  →  scaffolded [header, product_grid, footer]
  · skipped    search  (has merchant sections — not modified)

⚠ Warnings
  · Attribute 'columns' added with is_required=true to 'product_grid'
    3 existing sections have no value for this field

✓ Deploy completed in 1.4s
```

---

## Qué pasa con cada tipo de cambio

### Cambios seguros (siempre se aplican)

| Cambio | Qué hace |
|--------|----------|
| Nuevo section type | Lo crea |
| Nuevo atributo opcional | Lo añade al schema |
| Cambio de `label` o `order` | Lo actualiza |
| Activar `localizable` | Lo actualiza |
| Nueva página estática | La crea y scaffoldea |
| Nuevo `resolver_kind` en pages | Crea la plantilla y scaffoldea |

### Cambios con warning (se aplican pero avisan)

| Cambio | Warning |
|--------|---------|
| Nuevo atributo con `is_required: true` | N secciones existentes sin valor |
| Atributo eliminado del schema | Contenido del comercio quedará inaccesible |

### Cambios bloqueados (requieren `--force`)

| Cambio | Por qué |
|--------|---------|
| Cambiar el `type` de un atributo | El contenido guardado quedaría inválido |
| Renombrar un atributo (`name`) | Equivale a delete+create — el contenido se pierde |

---

## Re-deploy (iteraciones)

El deploy es **100% idempotente**. Córrelo en cada iteración sin miedo:

```bash
# Ciclo típico durante el desarrollo
pnpm dev                          # verificar en local
templateizer website-deploy       # subir cambios al website del cliente
# → solo lo nuevo se aplica, el contenido del comercio no se toca
```

---

## Mantener el sync entre código y manifiesto

Regla fundamental: **cada section type en `src/sections/` debe estar en `proxima.website.json`**.

```
src/sections/BannerSection.astro
  ↕
"key": "banner" en proxima.website.json
  ↕
banner: BannerSection en src/sections/index.ts (SECTION_MAP)
```

Si referencias un `section_type` en `scaffold_sections` que no está declarado en
`section_types`, el CLI lo detecta **antes** de llamar a la API:

```bash
templateizer website-deploy

# ✗ Invalid manifest at proxima.website.json:
#   pages[0].scaffold_sections[2].section_type: section_type 'banner' not declared in section_types
```

---

## Flujo completo de entrega a un cliente

```bash
# 1. Construir el storefront
pnpm dev

# 2. Definir el manifiesto
# → Cada sección implementada debe estar en proxima.website.json

# 3. Deploy
templateizer website-deploy
# → El Builder ya muestra las secciones disponibles
# → Las páginas tienen su estructura inicial lista

# 4. Entregar acceso al Builder al comercio
# → El comercio empieza a editar contenido inmediatamente

# --- Iteraciones futuras ---

# 5. Añadir nueva sección al código
# → Añadirla también en proxima.website.json
templateizer website-deploy   # solo crea lo nuevo, no toca el resto
```

---

## Diferencia con el flujo de marketplace

Si eventualmente quieres publicar este storefront como template reutilizable en el
Proxima Marketplace (para que otros comercios lo instalen), ese es un flujo separado
que usa `proxima.template.json`:

```bash
templateizer validate          # valida proxima.template.json
templateizer register          # registra el template en el marketplace
templateizer publish           # publica para que otros lo vean
```

Ver [08 — Template Authoring](./08-template-authoring.md) para ese flujo.

---

## Checklist antes de hacer deploy

- [ ] `.env` tiene `PROXIMA_SERVICE_KEY`, `PROXIMA_DOMAIN` y `PROXIMA_API_URL`
- [ ] El website existe en el admin de Proxima con ese dominio exacto
- [ ] `proxima.website.json` existe en la raíz del proyecto
- [ ] Cada sección en `src/sections/` tiene su entrada en `section_types`
- [ ] Cada `section_type` en `scaffold_sections` existe en la lista de `section_types`
- [ ] Los `key` en el manifiesto coinciden con los de `SECTION_MAP`
- [ ] `templateizer website-deploy --dry-run` muestra el payload esperado
