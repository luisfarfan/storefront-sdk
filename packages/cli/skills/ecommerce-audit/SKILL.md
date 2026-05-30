---
name: ecommerce-audit
description: >
  Auditar un storefront Proxima — UX ecommerce, CRO, mobile commerce,
  discoverability y conversión. Genera un reporte priorizado con hallazgos
  accionables mapeados a CMS / código / schema / SDK.
  Usar cuando: "audita la tienda", "revisa el UX del storefront",
  "qué le falta al ecommerce", "análisis CRO de X", "cómo mejorar la
  conversión", "qué falta para que sea world-class", "audit 214store".
  Se puede invocar con un slug: /ecommerce-audit 214store
---

# Skill: ecommerce-audit

> **Instalación:** `proxima skills install ecommerce-audit` · En monorepo: `apps/{slug}/`. Standalone: raíz del proyecto Astro.

Auditoría de ecommerce funcional — UX, CRO, mobile, discoverability y
conversión — anclada en observación real del sitio corriendo y en la
arquitectura concreta de Proxima.

**NO reportes nada sin haberlo observado directamente.**
El grounding es obligatorio antes de escribir cualquier hallazgo.

---

## Inputs

Parsear el slug del app desde el argumento del skill (e.g. `/ecommerce-audit 214store`).
Si no se provee, preguntar con **AskUserQuestion**:
- ¿Qué app auditar? (listar `ls apps/` y sus puertos)
- ¿Modo? `fixtures` (dev local) o `live` (API real)
- ¿Fase específica o auditoría completa?

Variables derivadas del slug:
```bash
# Puerto del app
grep "port" apps/{slug}/astro.config.mjs

# Modo de datos
cat apps/{slug}/.env | grep PROXIMA_DATA_MODE

# Rutas disponibles
grep '"path"' apps/{slug}/proxima.website.json
```

---

## PASO 0 — Grounding obligatorio (ejecutar ANTES de escribir)

```
1. Levantar el dev server del app si no está corriendo:
   preview_start → apps/{slug} → puerto del app

2. Para cada fase:
   a. Navegar la ruta con preview_eval: window.location.href = "{ruta}"
   b. preview_snapshot — estructura y contenido visible
   c. preview_screenshot — evidencia visual
   d. preview_resize 375×812 — repetir en mobile (mobile es prioridad)
   e. preview_console_logs — errores JS
   f. preview_network — latencia, requests fallidos

3. Para entender CÓMO está construido:
   - Leer el componente fuente en apps/{slug}/src/components/
   - Leer apps/{slug}/proxima.website.json para el schema CMS
   - NO asumir; verificar en código

4. Si una ruta no existe: reportar "no implementado", nunca describir
   lo que "suele haber" en ecommerce.
```

---

## Contexto de la plataforma (leer antes de juzgar)

### Modo de datos
- `PROXIMA_DATA_MODE=fixtures` → stock, precios, catálogo y ausencia de
  reviews son datos de fixture, NO bugs. Distinguir siempre:
  · artefacto de fixture | gap real de producto | decisión deliberada
- `PROXIMA_DATA_MODE=live` → datos reales; reportar sin excepciones.

### Arquitectura CMS-driven
- Las secciones de página viven en `proxima.website.json` (section_types)
  y se renderizan via `SectionRenderer.astro` (SECTION_REGISTRY).
- Una sección "ausente" puede ser que el merchant simplemente no la añadió,
  no un defecto del storefront.
- Los valores editables por el merchant llegan como props directas al
  componente (title, cta, low_stock_threshold, trust_badge_*, etc.).

### Shell sections (auto-gestionadas)
- `header`, `mega_menu`, `footer` → construidas en SSR desde la API
  (árbol de categorías, datos del business). No son editadas directamente
  en el Builder; sus campos configurables vienen de `section.values.*`.

### Single-tenant, mercado objetivo
- Una instancia = un website. Sin detección de hostname.
- Mercado peruano, catálogo tech/gaming. No medir contra catálogos de 50M SKUs.
- Marcar como sobre-ingeniería sugerencias que no aplican a esta escala.

---

## Fases de auditoría

Auditar **UNA fase a la vez**: entrega el análisis de una fase antes de
continuar. No vuelques todas las páginas juntas (produce análisis superficial).

| Fase | Ruta / Alcance |
|------|---------------|
| 1 | `/` — Home |
| 2 | `/productos` + MegaMenu — PLP, filtros, sorting |
| 3 | `product_detail` — PDP, galería, variantes, ATC sticky |
| 4 | `/carrito` — Cart |
| 5 | `/checkout` + `/login` — Checkout, guest, steps |
| 6 | Search overlay — autocomplete, recientes, empty state |
| 7 | Mobile pass (375px) — re-recorre fases 1–6: thumb zones, sticky, drawers |

---

## Qué evaluar por fase

Como **sistema funcional**, no componentes aislados.

### Home (/)
- Claridad inmediata: ¿se entiende qué vende la tienda en <3s?
- Prominencia de búsqueda
- Acceso rápido a categorías principales
- CTAs con intención de compra clara
- Promociones visibles vs ruido visual
- Velocidad para iniciar una compra
- Mobile: navegación, banners, scroll

### PLP (/productos)
- Breadcrumbs + categorías/subcategorías claras
- Filtros: útiles, dinámicos, mobile UX, activos visibles, limpiar fácil
- Sorting: relevancia, precio, popularidad, descuentos
- Cards de producto: precio claro, badges, stock, variantes visibles
- Quick add to cart
- Densidad correcta, facilidad de escaneo visual
- Paginación vs scroll infinito
- Empty states y no-results UX

### PDP (product_detail)
- Naming, pricing hierarchy, stock por variant
- Galería: suficientes imágenes, zoom, mobile swipe
- Variantes: selección clara, sincronización stock visual (data-stock por botón)
- Sticky ATC en mobile
- Trust signals: envío, garantía, devoluciones, pago seguro
- Urgencia y stock bajo threshold
- Productos relacionados, cross-sell
- Ausencia de reviews (es decisión deliberada — no reportar como bug)

### Cart (/carrito)
- Edición de cantidades y eliminación sin fricción
- Claridad de precios, costos de envío visibles (sin sorpresas)
- Cupones / promociones
- Persistencia del carrito
- Velocidad para ir a checkout
- Mobile: thumb zones, botón checkout accesible

### Checkout (/checkout)
- Guest checkout disponible
- Número de pasos y claridad del progreso
- Autocompletado de dirección
- Métodos de pago claros
- Validaciones en tiempo real
- Summary lateral siempre visible
- Mobile: formularios, teclado virtual, botón de confirmación

### Search overlay
- Autocomplete y tolerancia a typos
- Búsquedas recientes
- Búsquedas populares / sugerencias
- Resultados relevantes
- Empty state útil (no solo "sin resultados")
- Velocidad de respuesta

### Mobile pass
- Thumb zones en todas las páginas críticas
- Sticky CTAs (ATC, checkout, filtros)
- Drawer UX para menú y filtros
- Espaciado entre elementos interactivos
- Velocidad percibida en scroll
- Ningún componente de desktop mal adaptado

---

## Clasificación de factibilidad (obligatoria por hallazgo)

Cada hallazgo accionable lleva una etiqueta:

| Etiqueta | Dónde se resuelve |
|----------|--------------------|
| `[CMS]` | El merchant lo cambia en el Builder sin deploy (valores de sección, category_overrides, trust badges, threshold…) |
| `[CODE]` | Cambio en el storefront Astro — indicar archivo (apps/{slug}/src/…) |
| `[SCHEMA]` | Requiere nuevo atributo/sección en proxima.website.json + `proxima deploy {slug}` |
| `[SDK]` | Requiere cambio en packages/ o en la API de Proxima |
| `[SCAFFOLD]` | Mejora que debe bakearse en new-storefront-app para todos los futuros sitios |

La distinción `[CMS]` vs `[CODE]` vs `[SCAFFOLD]` es clave para decidir
si el hallazgo bloquea el go-live o si el merchant lo resuelve sin dev.

---

## Output por fase

```
## Fase N — {nombre}

### Evidencia
- Ruta navigada, viewport, screenshot adjunto.
- Modo: fixtures / live.

### Funciona bien
- [lista concreta de lo observado que funciona]

### Fricción y problemas observados
- Problema: [descripción específica]
  Causa: [qué se observó en código/snapshot]
  Tipo: artefacto de fixture | gap de producto | decisión deliberada

### Recomendaciones priorizadas

| # | Qué cambiar | Etiqueta | Esfuerzo | Impacto | Prioridad |
|---|-------------|----------|----------|---------|-----------|
| 1 | [descripción concreta] | [CMS/CODE/SCHEMA/SDK/SCAFFOLD] | S/M/L | alto/medio/bajo | P0/P1/P2 |

P0 = bloqueante go-live
P1 = mejora alta conversión / experiencia
P2 = nice-to-have / futura iteración
```

---

## Scoring (con rúbrica anclada)

Generar al final de la auditoría completa, NO por fase.
Cada score lleva UNA frase de justificación con evidencia observada.
Sin evidencia → no poner número.

| Eje | Rúbrica de anclaje |
|-----|-------------------|
| **1–3** | Falta, roto o genera abandono real — citar evidencia |
| **4–6** | Funciona pero por debajo del estándar moderno — citar qué falta |
| **7–8** | Sólido, estándar moderno cumplido |
| **9–10** | Sin fricción detectable, world-class para su escala |

Ejes:
- Ecommerce UX
- Discoverability
- Mobile Commerce
- Conversión
- Navegación
- Search UX
- Checkout UX
- PDP Quality
- PLP Quality
- Confianza
- Performance percibida
- Modern Ecommerce Standards

---

## Cierre — Top acciones y evolución del sistema

### Top 5 acciones globales (impacto / esfuerzo)
- Priorizadas por relación impacto/esfuerzo, no por página.
- Separar: las que el merchant hace ya en el Builder vs las que necesitan dev.

### Candidatos a SCAFFOLD
Si un hallazgo aparece como gap en este storefront Y es probable que
aparezca en el 80% de futuros storefronts → marcarlo como `[SCAFFOLD]`.
Estos son candidatos para mejorar `new-storefront-app` o el SDK.

### Candidatos a actualización del skill
Si se detectó un patrón nuevo de ecommerce que debería evaluarse en
futuros audits → describir en una línea el heurístico propuesto.
**No actualizar el skill automáticamente** — proponer y esperar aprobación.

---

## Ejemplos de referencias de componentes

Para orientar la búsqueda en código durante el análisis:

| Área | Componente |
|------|-----------|
| Header + búsqueda | `src/components/layout/Header.astro` |
| Mega menú | `src/components/layout/MegaMenu.astro` |
| PDP | `src/components/commerce/ProductDetail.astro` |
| Cart view | `src/components/commerce/CartView.astro` |
| Checkout | `src/components/commerce/CheckoutView.astro` |
| PLP (sección) | `src/components/sections/ProductGrid.astro` |
| Hero home | `src/components/sections/HeroBento.astro` |
| Categorías | `src/components/sections/CategoryGrid.astro` |
| Marcas | `src/components/sections/BrandsDirectory.astro` |
| Registro secciones | `src/components/sections/SectionRenderer.astro` |
| Script del carrito | `src/scripts/cart-actions.ts` |
| Schema secciones | `proxima.website.json` |
