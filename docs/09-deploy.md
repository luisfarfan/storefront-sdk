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

`proxima deploy` resuelve los **schemas y la estructura** en un solo comando.

> **No confundir con seed:** el deploy no sube catálogo, smart collections ni textos de secciones. Eso requiere scripts de seed (dev) o edición en Builder. En monorepo `proxima-storefronts`, ver `apps/214store/docs/DEPLOY.md` (orden: seed → deploy).

---

## Manifiesto y flujos

| Acción | Archivo | Comando |
|--------|---------|---------|
| Deploy a website de cliente | `proxima.website.json` | `proxima deploy` |
| Marketplace (registry) | mismo manifiesto + `marketplace_metadata` | `proxima template:create` / `template:publish` |

Un solo archivo **`proxima.website.json`** por app Astro. Incluye `section_types`, `pages`, `shell_sections`, `smart_collection_placeholders`, `shell_default_values`.

---

## Prerequisito: el website debe existir en el admin

El deploy no crea el website — ese paso se hace una sola vez desde el admin de Proxima
(o lo hace el equipo de Proxima al onboardear al comercio).

Lo que el deploy sí hace:
- Registrar los **section types** del storefront en ese website
- Crear las **páginas** definidas y poblarlas con secciones vacías listas para editar

---

## Configurar credenciales

### Opción A — Archivo JSON (recomendado)

```bash
proxima init
```

El wizard interactivo te pregunta API URL, dominio y service key, y crea `.proxima/credentials.json` automáticamente. También lo agrega al `.gitignore` para que nunca se commitee.

El archivo resultante:

```json
// .proxima/credentials.json
{
  "api_url":     "https://api.proxima.io",
  "domain":      "tienda-deportes.proxima.app",
  "service_key": "pxa_live_..."
}
```

Para usar un archivo en una ruta personalizada (útil con múltiples clientes):

```bash
proxima website-deploy apps/mi-tienda --credentials ~/secrets/cliente-a.json
```

### Opción B — Variables de entorno / `.env`

```env
PROXIMA_API_URL=https://api.proxima.io
PROXIMA_DOMAIN=tienda-deportes.proxima.app   # debe coincidir con el website en el admin
PROXIMA_WEBSITE_DOMAIN=tienda-deportes.proxima.app   # alias aceptado por el CLI
PROXIMA_SERVICE_KEY=pxa_live_...             # scope cms:websites:write
```

**Prioridad de resolución**: CLI flags → `process.env` → credentials JSON → `.env`

---

## El manifiesto — `proxima.website.json`

Define exactamente lo que el deploy sube a la API.

```json
{
  "schema_version": "1.0",
  "section_types": [...],
  "pages": [...],
  "shell_sections": [...]
}
```

`shell_sections` declara slots globales (header, mega_menu, footer). El deploy los crea vacíos si no existen; no sobrescribe valores ya configurados.

### `section_types`

Cada section type que implementaste en Astro **debe estar aquí**.
El `key` debe coincidir exactamente con el de `SECTION_REGISTRY` en el storefront.

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
    { "section_type": "hero_bento", "order": 1, "default_values": { "hero_products": "auto:featured_products" } },
    { "section_type": "product_grid", "order": 2 }
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
    { "section_type": "commerce_view", "order": 1 }
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
# 1. Validar proxima.website.json
proxima validate mi-tienda

# 2. Deploy
proxima deploy mi-tienda
```

El CLI mostrará un resumen del deploy y pedirá confirmación antes de proceder:

```
Deploy to: tienda-deportes.proxima.app
  3 section type(s)  ·  5 page(s)

  Continue? (Y/n) ›
```

### Flags disponibles

```bash
# Ver qué se enviaría sin hacer la llamada
proxima deploy mi-tienda --dry-run
proxima deploy mi-tienda --force
proxima deploy mi-tienda --yes
proxima deploy mi-tienda --page /contacto
proxima deploy mi-tienda --page product_detail
proxima deploy mi-tienda --credentials ~/secrets/cliente-a.json
```

> Si `proxima` termina sin output, usar `node node_modules/@proxima-io/templateizer/dist/index.js website-deploy .`

### `--page` — deploy página por página

El flag `--page` filtra el array `pages` del manifiesto antes de enviarlo a la API.
Los `section_types` **siempre se envían completos** porque la API los necesita para el scaffolding.

Si el valor no coincide con ningún `path` ni `resolver_kind` del manifiesto, el CLI muestra error con las opciones disponibles:

```
✗ No pages matched filter: /pagina-inexistente
  Available: /, /productos, product_detail, /carrito, /checkout, ...
```

> **Cuándo usarlo:** cuando se construye el storefront de forma incremental y se quiere ir
> subiendo cada página conforme se termina, sin deployar secciones de páginas incompletas.

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

Cuando el CLI detecta breaking changes muestra los detalles y pregunta interactivamente:

```
✗ Breaking changes detectados:

  Section type : hero
  Attribute    : title
  Change       : type from 'text' to 'rich_text'

  Note: existing attribute content may be incompatible with the new type.

  Apply breaking changes anyway? (y/N) ›
```

Si aceptas, el CLI re-ejecuta el deploy con `--force` automáticamente. En CI el prompt se omite y el deploy falla (correcto — el `--force` debe ser explícito en CI).

---

## Re-deploy (iteraciones)

El deploy es **100% idempotente**. Córrelo en cada iteración sin miedo.

El `attribute_schema` del manifiesto define el formulario del Builder (`help_text`, `options`). Ver [07-cms-attribute-schema.md](./07-cms-attribute-schema.md).

```bash
# Ciclo típico durante el desarrollo
pnpm dev                          # verificar en local
proxima deploy mi-tienda   # subir cambios al website del cliente
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
banner: BannerSection en SECTION_REGISTRY
```

Si referencias un `section_type` en `scaffold_sections` que no está declarado en
`section_types`, el CLI lo detecta **antes** de llamar a la API:

```bash
proxima deploy mi-tienda

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
proxima deploy mi-tienda
# → El Builder ya muestra las secciones disponibles
# → Las páginas tienen su estructura inicial lista

# 4. Entregar acceso al Builder al comercio
# → El comercio empieza a editar contenido inmediatamente

# --- Iteraciones futuras ---

# 5. Añadir nueva sección al código
# → Añadirla también en proxima.website.json
proxima deploy mi-tienda   # solo crea lo nuevo, no toca el resto
```

---

## Diferencia con el flujo de marketplace

Si quieres publicar el storefront como template en el Proxima Marketplace, usa el mismo
`proxima.website.json` con bloque `marketplace_metadata`:

```bash
proxima template:create mi-tienda
proxima template:publish mi-tienda
```

Ver [08 — Template Authoring](./08-template-authoring.md) para ese flujo.

---

## Uso en CI

En CI los prompts interactivos se deshabilitan automáticamente (cuando `CI=1`, `GITHUB_ACTIONS=1`, `NO_INTERACTIVE=1` o stdin no es TTY). Las credenciales deben venir de secrets del entorno:

```yaml
# GitHub Actions
- name: Deploy website
  run: proxima deploy mi-tienda
  env:
    PROXIMA_API_URL: ${{ secrets.PROXIMA_API_URL }}
    PROXIMA_SERVICE_KEY: ${{ secrets.PROXIMA_SERVICE_KEY }}
    PROXIMA_DOMAIN: ${{ secrets.PROXIMA_DOMAIN }}
```

---

## Checklist antes de hacer deploy

- [ ] Credenciales configuradas: `.proxima/credentials.json` (run `init`) o variables de entorno
- [ ] El website existe en el admin de Proxima con ese dominio exacto
- [ ] `proxima.website.json` existe en la raíz del proyecto
- [ ] Cada sección en `src/sections/` tiene su entrada en `section_types`
- [ ] Cada `section_type` en `scaffold_sections` existe en la lista de `section_types`
- [ ] Los `key` en el manifiesto coinciden con los de `SECTION_REGISTRY`
- [ ] `proxima deploy mi-tienda --dry-run` muestra el payload esperado
- [ ] Si hubo seed que recreó el website: service account con `website_id` actual (403 si no)
- [ ] Para deployar solo algunas páginas: usar `--page /ruta` (repetible)
