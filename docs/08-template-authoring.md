# 08 — Template Authoring

Cómo convertir un storefront en un template reutilizable que los comercios pueden
instalar con un click desde el Proxima Marketplace.

---

## ¿Qué es un template?

Un template empaqueta:
- La **estructura de páginas** (qué rutas existen y qué tipo son)
- Los **tipos de sección** disponibles (con sus schemas de atributos)
- Los **datos de muestra** para el preview en el marketplace
- El **código del storefront** que renderiza todo lo anterior

```
proxima.website.json   ← manifiesto (deploy + marketplace structure)
src/                   ← código Astro del storefront
  components/sections/ ← componentes de sección
  layouts/             ← SiteLayout (shell global)
  pages/               ← catch-all + API routes
```

> **Nota:** el nombre canónico del manifiesto es **`proxima.website.json`**. Sirve tanto para
> `proxima deploy` (website de un cliente) como para empaquetar la estructura del template en el
> marketplace. No repitas header/footer en cada página — van en `shell_sections`.

---

## `proxima.website.json` — El manifiesto

```json
{
  "schema_version": "1.0",
  "section_types": [ "... ver abajo ..." ],
  "pages": [
    {
      "path": "/",
      "resolver_kind": "content_page",
      "label": "Home",
      "scaffold_sections": [
        {
          "section_type": "hero_bento",
          "order": 1,
          "default_values": { "hero_products": "auto:featured_products" }
        },
        { "section_type": "product_grid", "order": 2 }
      ]
    },
    {
      "path": "/producto/{slug}",
      "resolver_kind": "product_detail",
      "label": "Detalle de producto",
      "scaffold_sections": []
    },
    {
      "path": "/categoria/{slug}",
      "resolver_kind": "category_detail",
      "label": "Categoría",
      "scaffold_sections": [
        { "section_type": "product_grid", "order": 1 }
      ]
    },
    {
      "path": "/buscar",
      "resolver_kind": "buyer_search",
      "label": "Búsqueda",
      "scaffold_sections": []
    }
  ],
  "shell_sections": [
    { "key": "header", "section_type": "header", "order": 1 },
    { "key": "mega_menu", "section_type": "mega_menu", "order": 2 },
    { "key": "footer", "section_type": "footer", "order": 3 }
  ],
  "smart_collection_placeholders": {
    "featured_products": {
      "name": "Productos Destacados",
      "type": "product_list",
      "config": { "filter": "featured" },
      "cache_ttl": 300
    }
  },
  "shell_default_values": {
    "header": { "logo": { "text": "Mi Tienda", "href": "/" } }
  },
  "marketplace_metadata": {
    "key": "mi-tienda",
    "label": "Mi Tienda",
    "description": "Storefront moderno para tiendas de moda.",
    "version": "1.0.0",
    "category": "fashion",
    "preview_url": "https://mi-tienda-preview.proxima.app"
  }
}
```

Fragmento de `section_types` (el array completo vive en el manifiesto real):

```json
  "section_types": [
    {
      "key": "header",
      "label": "Header",
      "category": "shell",
      "attribute_schema": [
        { "name": "logo",      "label": "Logo",       "type": "image",   "order": 1 },
        { "name": "nav_links", "label": "Navegación", "type": "array",   "order": 2,
          "config": { "item_fields": [{ "name": "label", "type": "text" }, { "name": "url", "type": "text" }] }
        }
      ]
    },
    {
      "key": "hero",
      "label": "Hero Principal",
      "category": "content",
      "attribute_schema": [
        { "name": "image",       "label": "Imagen",    "type": "image",   "is_required": true, "order": 1 },
        { "name": "headline",    "label": "Título",    "type": "text",    "localizable": true,  "order": 2 },
        { "name": "subheadline", "label": "Subtítulo", "type": "text",    "localizable": true,  "order": 3 },
        { "name": "cta",         "label": "Botón CTA", "type": "link",                          "order": 4 }
      ]
    },
    {
      "key": "product_grid",
      "label": "Grilla de Productos",
      "category": "commerce",
      "attribute_schema": [
        { "name": "headline",  "label": "Título",    "type": "text",                "order": 1 },
        { "name": "products",  "label": "Productos", "type": "smart_collection_id", "order": 2,
          "config": { "allowed_smart_collection_types": ["product_list", "manual"] }
        },
        { "name": "columns",   "label": "Columnas",  "type": "number",              "order": 3,
          "config": { "min": 2, "max": 5 }
        }
      ]
    },
    {
      "key": "footer",
      "label": "Footer",
      "category": "shell",
      "attribute_schema": [
        { "name": "copyright", "label": "Copyright", "type": "text",  "order": 1 },
        { "name": "links",     "label": "Links",     "type": "array", "order": 2,
          "config": { "item_fields": [{ "name": "label", "type": "text" }, { "name": "url", "type": "text" }] }
        }
      ]
    }
  ]
```

---

## Presets de páginas

En lugar de definir cada página a mano, puedes usar presets:

```json
{
  "preset": "standard_ecommerce"
}
```

| Preset | Páginas incluidas |
|--------|------------------|
| `standard_ecommerce` | Home, Product Detail, Category, Brand, Search, Product List, Cart |
| `minimal` | Home, Product Detail, Search |

Los presets definen la estructura de páginas pero **no** los section types —
esos los defines tú.

---

## CLI — `@proxima-io/cli` (`proxima`)

```bash
npm install -g @proxima-io/cli
# o en monorepo: npm run proxima -- <comando>
```

### Comandos relevantes para templates

```bash
# Validar manifiesto
proxima validate mi-tienda

# Deploy schemas + páginas a un website de staging
proxima deploy mi-tienda

# Registrar template en marketplace (primera vez)
proxima template:create mi-tienda

# Publicar versión
proxima template:publish mi-tienda
```

El engine subyacente es `@proxima-io/templateizer`; la CLI descubre apps por `proxima.website.json`.

### Flujo típico

```bash
proxima init mi-tienda          # credenciales
proxima validate mi-tienda      # iterar schema + código
proxima deploy mi-tienda        # probar en website staging
proxima template:create mi-tienda
proxima template:publish mi-tienda
```

---

## Tipos de sección — Categorías estándar

| Categoría | Tipos de sección típicos |
|-----------|--------------------------|
| `shell` | header, mega_menu, footer — **global**, no en `scaffold_sections` de páginas |
| `content` | hero_bento, cta_banner, faq, testimonials |
| `commerce` | product_grid, category_showcase, commerce_view |
| `social` | instagram_feed, review_widget |
| `utility` | spacer, divider, custom_html |

---

## Sample data para el preview

El preview del marketplace usa el storefront en modo **fixtures** (`PROXIMA_TEMPLATE_DEMO_DOMAIN`)
con JSON en `src/fixtures/` (website, composition, shell, catálogo).

Para valores iniciales al instanciar el template:
- `scaffold_sections[].default_values` — contenido de páginas nuevas
- `shell_default_values` — header, mega_menu, footer
- `smart_collection_placeholders` + `"auto:featured_products"` — colecciones al detectar catálogo

Ver golden template: `apps/214store/proxima.website.json` y `src/fixtures/`.

---

## Versionado del template

Los templates usan [semver](https://semver.org/):

```
1.0.0  → Primera versión estable
1.0.1  → Bugfix (CSS, typo, etc.)
1.1.0  → Nueva sección añadida (backward compatible)
2.0.0  → Cambio breaking (sección renombrada, atributo eliminado)
```

Cuando el comercio tiene instalado `v1.0.0` y public as `v1.1.0`,
el admin les notifica que hay una actualización disponible.
Pueden actualizar con un click — sus datos se preservan.

**Cambios breaking (v2.x):** si eliminas un atributo o cambias su tipo,
la actualización es manual. Proxima muestra un aviso al comercio.

---

## Atributos — opciones de configuración

Cada atributo en `attribute_schema` puede tener un campo `config` para
restringir los valores posibles.

**Guía completa (help_text vs options, selects, overrides):** [07-cms-attribute-schema.md](./07-cms-attribute-schema.md)

```json
{ "name": "columns", "type": "number", "config": { "min": 2, "max": 6, "step": 1 } }

{ "name": "products", "type": "smart_collection_id",
  "config": { "allowed_smart_collection_types": ["product_list"] } }

{ "name": "variant", "type": "select",
  "config": {
    "help_text": "Tema visual de la franja.",
    "schema": {
      "mode": "scalar",
      "fields": [{
        "name": "value",
        "type": "select",
        "options": [
          { "value": "primary", "label": "Primary" },
          { "value": "secondary", "label": "Secondary" }
        ]
      }]
    }
  } }

{ "name": "items", "type": "array",
  "config": {
    "schema": {
      "mode": "array",
      "item_fields": [
        { "name": "title", "type": "text" },
        { "name": "body",  "type": "rich_text" }
      ]
    },
    "max_items": 10
  }
}
```

Legado: `"config": { "options": ["primary", "secondary"] }` en `type: "text"` sigue válido (label = value).

---

## Publicar en el Marketplace

Requisitos para publicar:

1. `proxima validate` sin errores
2. Preview URL funcionando y accesible
3. Al menos 4 section types implementados
4. Sample data configurado para el preview
5. Descripción en español e inglés

```bash
# Verificar que todo esté en orden
proxima validate mi-tienda

# Enviar para revisión
proxima template:publish mi-tienda
# → El equipo de Proxima revisa en 2-5 días hábiles
# → Recibes notificación por email
```

---

## Multi-idioma en templates

Si tu template soporta varios locales, los atributos con `localizable: true`
se gestionan automáticamente. El builder muestra un editor por idioma para esos campos.

```json
{
  "name": "headline",
  "type": "text",
  "localizable": true,
  "label": "Título"
}
```

No necesitas hacer nada extra en el código Astro — la API ya resuelve el locale correcto.

---

## Checklist para publicar un template

- [ ] `proxima.website.json` válido (`proxima validate`)
- [ ] Todos los `section_types` tienen componente en `src/components/sections/` y entrada en `SECTION_REGISTRY`
- [ ] `shell_sections` declarado; header/footer **no** duplicados en cada página
- [ ] Fixtures de preview (`src/fixtures/`) alineados con el manifiesto
- [ ] Preview URL desplegada y accesible públicamente
- [ ] `.env.example` con las variables necesarias
- [ ] `README.md` con instrucciones para el developer que instale el template
- [ ] Versión en semver (e.g. `1.0.0`)
