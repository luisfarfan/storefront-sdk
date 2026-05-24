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
proxima.template.json  ← manifiesto del template
src/                   ← código Astro del storefront
  sections/            ← los componentes de sección
  components/
  layouts/
  pages/
```

---

## `proxima.template.json` — El manifiesto

```json
{
  "schema_version": "1.0",
  "key": "mi-tienda",
  "label": "Mi Tienda",
  "description": "Storefront moderno para tiendas de moda.",
  "version": "1.0.0",
  "category": "fashion",
  "preview_url": "https://mi-tienda-preview.proxima.app",
  "pages": [
    {
      "path": "/",
      "resolver_kind": "content_page",
      "label": "Home",
      "sections": [
        { "type": "header", "order": 1 },
        { "type": "hero",   "order": 2 },
        { "type": "product_grid", "order": 3, "label": "Destacados" },
        { "type": "footer", "order": 99 }
      ]
    },
    {
      "path": "/producto/{slug}",
      "resolver_kind": "product_detail",
      "label": "Detalle de producto",
      "sections": [
        { "type": "header", "order": 1 },
        { "type": "product_detail", "order": 2 },
        { "type": "related_products", "order": 3 },
        { "type": "footer", "order": 99 }
      ]
    },
    {
      "path": "/categoria/{slug}",
      "resolver_kind": "category_detail",
      "label": "Categoría",
      "sections": [
        { "type": "header", "order": 1 },
        { "type": "category_hero", "order": 2 },
        { "type": "product_grid", "order": 3 },
        { "type": "footer", "order": 99 }
      ]
    },
    {
      "path": "/buscar",
      "resolver_kind": "search",
      "label": "Búsqueda",
      "sections": [
        { "type": "header", "order": 1 },
        { "type": "search", "order": 2 },
        { "type": "footer", "order": 99 }
      ]
    }
  ],
  "section_types": [
    {
      "key": "header",
      "label": "Header",
      "category": "navigation",
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
      "category": "navigation",
      "attribute_schema": [
        { "name": "copyright", "label": "Copyright", "type": "text",  "order": 1 },
        { "name": "links",     "label": "Links",     "type": "array", "order": 2,
          "config": { "item_fields": [{ "name": "label", "type": "text" }, { "name": "url", "type": "text" }] }
        }
      ]
    }
  ]
}
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

## La CLI `templateizer`

```bash
# Instalar globalmente o como devDependency
pnpm add -D @proxima-io/templateizer

# O usar directamente
pnpm exec templateizer <comando>
```

### Comandos

```bash
# Validar el manifiesto localmente
templateizer validate

# Registrar el template en el tenant (primera vez)
templateizer register --key mi-tienda

# Subir nueva versión del template
templateizer deploy --version 1.1.0

# Publicar en el marketplace (requiere aprobación de Proxima)
templateizer publish

# Sincronizar section types con el admin sin versionar
templateizer sync
```

### Flujo típico de desarrollo

```bash
# 1. Crear el manifiesto
templateizer init

# 2. Iterar: editar código + schema → validar
templateizer validate

# 3. Registrar en el tenant de staging
templateizer register --env staging

# 4. Instalar el template en un website de staging para probar
# (desde el admin de Proxima)

# 5. Cuando listo, deployar versión final
templateizer deploy --version 1.0.0

# 6. Publicar en marketplace
templateizer publish
```

---

## Tipos de sección — Categorías estándar

| Categoría | Tipos de sección típicos |
|-----------|--------------------------|
| `navigation` | header, footer, breadcrumb |
| `content` | hero, banner, rich_text_block, faq, testimonials |
| `commerce` | product_grid, product_detail, category_hero, cart_summary |
| `social` | instagram_feed, review_widget |
| `utility` | spacer, divider, custom_html |

---

## Sample data para el preview

El marketplace muestra un preview con datos de muestra.
Configura los datos en `proxima.template.json`:

```json
{
  "sample_data": {
    "sections": {
      "hero": {
        "image": "https://cdn.proxima.io/templates/mi-tienda/hero.jpg",
        "headline": "Nueva Colección Verano",
        "subheadline": "Descubre los últimos estilos",
        "cta": { "url": "/productos", "label": "Ver colección" }
      },
      "product_grid": {
        "headline": "Productos Destacados"
      }
    }
  }
}
```

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
restringir los valores posibles:

```json
{ "name": "columns", "type": "number", "config": { "min": 2, "max": 6, "step": 1 } }

{ "name": "products", "type": "smart_collection_id",
  "config": { "allowed_smart_collection_types": ["product_list"] } }

{ "name": "variant", "type": "text",
  "config": { "options": ["primary", "secondary", "dark"] } }

{ "name": "items", "type": "array",
  "config": {
    "item_fields": [
      { "name": "title",   "type": "text" },
      { "name": "body",    "type": "rich_text" },
      { "name": "icon",    "type": "image" }
    ],
    "max_items": 10
  }
}
```

---

## Publicar en el Marketplace

Requisitos para publicar:

1. `templateizer validate` sin errores
2. Preview URL funcionando y accesible
3. Al menos 4 section types implementados
4. Sample data configurado para el preview
5. Descripción en español e inglés

```bash
# Verificar que todo esté en orden
templateizer validate --strict

# Enviar para revisión
templateizer publish
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

- [ ] `proxima.template.json` válido (`templateizer validate`)
- [ ] Todos los `section_types` listados tienen su componente Astro en `src/sections/`
- [ ] Todos los componentes están en el `SECTION_MAP`
- [ ] Sample data configurado para el preview del marketplace
- [ ] Preview URL desplegada y accesible públicamente
- [ ] `.env.example` con las variables necesarias
- [ ] `README.md` con instrucciones para el developer que instale el template
- [ ] Versión en semver (e.g. `1.0.0`)
