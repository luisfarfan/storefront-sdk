---
name: website-deploy
description: >
  Ejecutar, diagnosticar o entender el deploy de section types y pages a un website
  de Proxima. Usar cuando el usuario quiere: "hacer deploy", "subir las secciones",
  "por qué falla el deploy", "qué hace templateizer website-deploy", "entender el 409",
  "forzar cambios breaking", "el Builder no muestra mis secciones".
---

# Skill: website-deploy

Guía completa del comando `templateizer website-deploy` y el endpoint subyacente.

> **Para entender el lifecycle completo** (deploy + template:publish + instantiate, schema del manifest, storage map): **`proxima-api/docs/cms-template-lifecycle.md`**. Esta skill cubre solo el flujo de `proxima deploy`.

---

## ¿Qué hace el deploy?

Sincroniza el `proxima.website.json` del proyecto con la API de Proxima.
Específicamente:

1. **Section types**: Crea los que no existen, actualiza los que cambiaron (si el cambio es seguro), detecta breaking changes.
2. **Pages**: Crea las páginas que no existen y las scaffoldea con secciones vacías. Si la página ya tiene secciones del comercio, la omite.

**Es 100% idempotente** — el mismo manifest siempre produce el mismo resultado.

**`attribute_schema`:** lo define el developer en el manifiesto (`help_text`, `options` estructuradas). Guía: [`docs/07-cms-attribute-schema.md`](../../docs/07-cms-attribute-schema.md). La API persiste en `WebsiteSectionType` sin hardcode por section type.

También sincroniza **`shell_sections`** (header, mega_menu, footer) si el manifiesto los declara y aún no existen en el website.

---

## Deploy vs seed (no confundir)

| Herramienta | Qué sube | Qué **no** hace |
|-------------|----------|------------------|
| **`website-deploy`** | `section_types`, páginas vacías si faltan, slots de shell | Catálogo, smart collections, textos/valores de secciones, contenido del shell |
| **Scripts de seed** (p. ej. `proxima-api/scripts/seed_214store_website.py`) | Website, catálogo, home con valores, shell con datos | Schemas por-website del Builder |

**Orden local 214store:** seed → deploy. En monorepo `proxima-storefronts`: `apps/214store/docs/DEPLOY.md`.

Tras un seed que **recrea** el website, el `website_id` cambia. Si el deploy devuelve **403**, la service account puede seguir ligada al website viejo — actualizar `website_id` en admin o re-ejecutar el seed (214store re-enlaza accounts del business).

---

## Prerequisitos

Verificar que `.env` tiene:

```env
PROXIMA_API_URL=https://api.proxima.io
PROXIMA_DOMAIN=<dominio-exacto-del-website>
PROXIMA_SERVICE_KEY=pxa_live_...
```

Alias aceptado: `PROXIMA_WEBSITE_DOMAIN` (mismo valor que `PROXIMA_DOMAIN`).

El website debe existir en el admin de Proxima. El deploy no lo crea (salvo scripts de seed en dev).

---

## Ejecutar el deploy

```bash
# Desde la raíz del proyecto storefront (donde está proxima.website.json)

# Preview — ver el payload sin llamar la API
proxima deploy --dry-run
# o: node node_modules/@proxima-io/templateizer/dist/index.js website-deploy . --dry-run

# Deploy estándar (todas las páginas)
proxima deploy

# En proxima-storefronts/apps/214store (recomendado — salida visible):
npm run manifest:deploy

# Breaking changes
proxima deploy --force

# Sin prompts (CI/CD)
proxima deploy --yes

# Overrides para CI/CD (sin depender de .env)
proxima deploy \
  --api-url https://api.proxima.io \
  --domain mitienda.proxima.app \
  --service-key pxa_live_xxx
```

> Si `proxima` termina en silencio sin output, invocar con `node node_modules/@proxima-io/templateizer/dist/index.js website-deploy .` como fallback.

### Deploy página por página — flag `--page`

El flag `--page <path>` filtra el array `pages` antes de enviarlo a la API. Los `section_types` siempre se envían completos. El flag es **repetible**.

```bash
# Una sola página (por path)
proxima deploy --page /contacto

# Por resolver_kind (páginas dinámicas sin path fijo)
proxima deploy --page product_detail

# Varias páginas
proxima deploy --page /blog --page /contacto

# Dry-run para verificar el payload antes
proxima deploy --page /sobre-nosotros --dry-run
```

Si el path no coincide con ninguna entrada en el manifiesto, el CLI imprime error con las disponibles:

```
✗ No pages matched filter: /pagina-inexistente
  Available: /, /productos, product_detail, /carrito, /checkout, ...
```

> Útil para iterar página por página durante el desarrollo sin deployar todo el manifiesto de una vez.

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
  · skipped    search  (has merchant sections — not modified)

⚠ Warnings
  · Attribute 'columns' added with is_required=true to 'product_grid'
    3 existing sections have no value for this field

✓ Deploy completed in 1.4s
```

---

## Tipos de cambios y qué le pasa a cada uno

### Siempre se aplican (seguros)

| Cambio en el manifiesto | Resultado |
|-------------------------|-----------|
| Nuevo section type | Creado |
| Nuevo atributo sin `is_required` | Añadido al schema |
| Cambiar `label` o `order` | Actualizado |
| Activar `localizable: true` | Actualizado |
| Nueva página estática (`content_page`) | Creada y scaffoldeada |
| Nuevo `resolver_kind` en pages | Plantilla creada y scaffoldeada |

### Se aplican con warning

| Cambio | Warning generado |
|--------|-----------------|
| Nuevo atributo con `is_required: true` | "N existing sections have no value for this field" |

> El deploy procede normalmente. El warning es informativo para que el comercio sepa
> que tiene secciones con campos vacíos que deberían llenar.

### Bloqueados — requieren `--force`

| Cambio | Por qué es bloqueado |
|--------|---------------------|
| Cambiar el `type` de un atributo existente | El contenido guardado del comercio quedaría inválido |
| Renombrar un atributo (cambiar `name`) | Equivale a eliminar el original + crear uno nuevo — el contenido se pierde |

Cuando hay breaking changes sin `--force`:
```
✗ Breaking changes detected. Re-run with --force to apply.

  hero.image: type changed  image → text
```

Con `--force`:
```
npx proxima-templateizer website-deploy . --force
```

> **Usar `--force` con cuidado en producción.** Si el comercio tiene contenido configurado
> en el atributo que cambia, ese contenido quedará inaccesible o inválido.

---

## Lógica de pages (scaffold)

El scaffold solo se ejecuta cuando **la página no tiene secciones creadas por el comercio**.

```
┌─────────────────────────────────────────────────┐
│  ¿Existe la página en la BD?                    │
│                                                 │
│  No → Crear página + crear secciones vacías     │
│       (scaffold_sections)                       │
│                                                 │
│  Sí, sin secciones → Crear secciones vacías     │
│                       (scaffold_sections)       │
│                                                 │
│  Sí, con secciones → SKIP (no tocar)            │
└─────────────────────────────────────────────────┘
```

"Secciones del comercio" = cualquier sección en la tabla `sections` de la BD.
El deploy no distingue entre secciones del scaffold inicial o secciones añadidas a mano.

---

## El endpoint subyacente

El CLI llama a:
```
POST /api/v1/admin/cms/websites/deploy[?force=true]
Authorization: Bearer <PROXIMA_SERVICE_KEY>
Content-Type: application/json
```

Payload (lo que construye el CLI desde `proxima.website.json`):
```json
{
  "website_domain": "mitienda.proxima.app",
  "section_types": [
    {
      "key": "hero",
      "label": "Hero Principal",
      "category": "content",
      "attribute_schema": [
        { "name": "image",    "label": "Imagen", "type": "image", "is_required": true, "order": 1 },
        { "name": "headline", "label": "Título", "type": "text",  "localizable": true,  "order": 2 }
      ]
    }
  ],
  "pages": [
    {
      "resolver_kind": "content_page",
      "path": "/",
      "label": "Home",
      "scaffold_sections": [
        { "section_type": "hero", "order": 1 }
      ]
    }
  ],
  "shell_sections": [
    { "key": "header", "section_type": "header", "order": 1 },
    { "key": "mega_menu", "section_type": "mega_menu", "order": 2 },
    { "key": "footer", "section_type": "footer", "order": 3 }
  ]
}
```

Respuesta 200:
```json
{
  "ok": true,
  "website": { "id": "uuid", "domain": "mitienda.proxima.app" },
  "section_types": {
    "created":   ["hero"],
    "updated":   [],
    "unchanged": []
  },
  "pages": {
    "created":   ["/"],
    "scaffolded": { "/": ["hero"] },
    "skipped":   {}
  },
  "warnings": []
}
```

---

## Diagnóstico de errores

### `404 — Website 'X' not found`

El `PROXIMA_DOMAIN` en `.env` no coincide con ningún website en el admin.

**Verificar:**
1. `cat .env | grep PROXIMA_DOMAIN`
2. Comparar con el dominio exacto en el admin de Proxima
3. Es case-sensitive y sin trailing slash

---

### `403 — Not authorized for this website` / Access denied

**Causas comunes:**
1. **`business_id` distinto** — el token no es del negocio dueño del website.
2. **`website_id` distinto** — la service account está ligada a un website concreto y el dominio fue **re-creado** (p. ej. tras un seed). Actualizar `website_id` en admin o re-ejecutar el seed que re-enlaza accounts.
3. **Scope** — falta `cms:websites:write`.
4. Service key de otro proyecto o `business_id` equivocado al crear el token.

**Solución:** Corregir enlace website ↔ service account, o pedir un token nuevo al equipo de Proxima.

---

### `409 — Breaking changes detected`

El manifiesto tiene cambios que invalidarían contenido existente.

**Respuesta del API:**
```json
{
  "detail": {
    "message": "Breaking changes detected. Re-run with ?force=true to apply.",
    "breaking_changes": [
      {
        "section_type": "hero",
        "attribute": "image",
        "change": "type_changed",
        "from": "image",
        "to": "text"
      }
    ]
  }
}
```

**Opciones:**
1. Revertir el cambio en `proxima.website.json` (si fue un error)
2. `npx proxima-templateizer website-deploy . --force` (si el cambio es intencional y se acepta perder el contenido)

---

### `422 — content_page requires path`

Una página con `resolver_kind: "content_page"` no tiene `path`.

```json
// ✗ Mal
{ "resolver_kind": "content_page", "label": "Home", "scaffold_sections": [] }

// ✓ Bien
{ "resolver_kind": "content_page", "path": "/", "label": "Home", "scaffold_sections": [] }
```

---

### `422 — section_type 'X' not declared in section_types`

Un entry en `scaffold_sections` referencia un `section_type` que no está en la lista `section_types` del mismo manifiesto.

```json
// ✗ Mal — 'banner' no está en section_types
{
  "section_types": [{ "key": "hero", ... }],
  "pages": [{
    "scaffold_sections": [
      { "section_type": "banner", "order": 1 }  // ERROR: no existe
    ]
  }]
}

// ✓ Bien — 'banner' está declarado
{
  "section_types": [
    { "key": "hero", ... },
    { "key": "banner", ... }
  ],
  "pages": [{
    "scaffold_sections": [
      { "section_type": "banner", "order": 1 }
    ]
  }]
}
```

---

### `401 — Unauthorized`

No se envió el Bearer token o es inválido.

**Verificar:**
```bash
cat .env | grep PROXIMA_SERVICE_KEY
# Debe tener un valor que empiece con pxa_
```

---

## Flujo de CI/CD

Para deploy automático en cada push:

```yaml
# .github/workflows/deploy.yml
- name: Deploy to Proxima
  working-directory: apps/mi-tienda
  run: npm run manifest:deploy
  env:
    PROXIMA_API_URL: ${{ secrets.PROXIMA_API_URL }}
    PROXIMA_DOMAIN: ${{ secrets.PROXIMA_WEBSITE_DOMAIN }}
    PROXIMA_SERVICE_KEY: ${{ secrets.PROXIMA_SERVICE_KEY }}
```

O con flags explícitos (sin depender de .env):
```bash
npx proxima-templateizer website-deploy . \
  --api-url "$PROXIMA_API_URL" \
  --domain "$PROXIMA_DOMAIN" \
  --service-key "$PROXIMA_SERVICE_KEY"
```

---

## Reglas de validación del manifiesto (client-side, antes de llamar la API)

El CLI valida esto antes de hacer la llamada:

1. `section_types` no puede estar vacío
2. No puede haber dos section types con el mismo `key`
3. Cada `section_type` en `scaffold_sections` debe existir en `section_types`
4. `content_page` requiere `path`
5. Los tipos de atributos deben ser uno de: `text | rich_text | image | boolean | number | datetime | link | object | array | smart_collection_id`

Si falla la validación, el CLI imprime el error y sale con code 1 sin llamar a la API.

---

## Iterar rápidamente

```bash
# Ciclo de desarrollo
pnpm dev                  # servidor local
# editar proxima.website.json
proxima deploy            # subir cambios
# solo lo nuevo se aplica
# el contenido del comercio nunca se toca
```

El deploy es tan barato de ejecutar que se recomienda correrlo cada vez que cambia
el manifiesto, no solo al final del proyecto.
