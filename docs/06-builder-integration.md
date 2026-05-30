# 06 — Builder Integration

Cómo conectar el storefront con el Proxima Builder para edición en tiempo real.

---

## ¿Qué es el Builder?

El Proxima Builder es un iframe que carga tu storefront en "preview mode".
El comercio puede hacer click en cualquier elemento editable, editar el contenido,
y ver los cambios en tiempo real — sin recargar la página.

La comunicación entre el Builder (parent) y el storefront (iframe) ocurre
via `window.postMessage`.

```
┌─────────────────────────────────────────────────────┐
│  Proxima Admin                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │  Section tree       │  │  Attribute editor   │   │
│  │  ──────────────     │  │  ──────────────      │   │
│  │  • Header           │  │  headline: "Bien..." │   │
│  │  • Hero ←selected   │  │  subheadline: "Los.."│   │
│  │  • Product Grid     │  │                     │   │
│  └─────────────────────┘  └─────────────────────┘   │
│                                                       │
│  ┌───────────────────────────────────────────────┐   │
│  │  iframe → tu storefront en preview mode       │   │
│  │                                               │   │
│  │  [Header]                                     │   │
│  │  [Hero ── con outline azul porque selected]   │   │
│  │  [Product Grid]                               │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Convención golden template

En storefronts actuales los componentes reciben **props** + **`attributesMeta`**, no el objeto `section` entero:

```astro
---
import { getSectionAttr } from "@proxima-io/storefront-builder-sdk";
import EditableAttribute from "@proxima-io/storefront-builder-sdk/EditableAttribute.astro";

interface Props {
  cmsPreview?: boolean;
  attributesMeta?: Record<string, unknown>;
  headline?: string;
}
const { key: attributeKey } = getSectionAttr(Astro.props.attributesMeta);
---
<EditableAttribute meta={attributeKey("headline")} value={Astro.props.headline}>
  <h1>{Astro.props.headline}</h1>
</EditableAttribute>
```

`SectionRenderer` pasa `section.values.headline` como prop y `section.attributesMeta` para el Builder.

Los ejemplos siguientes usan `section` genérico por brevedad — en código real prefiere props + `getSectionAttr`.

---

## Setup en SiteLayout

El `CmsPreviewBridge` debe estar en el layout base. Solo activa la comunicación
cuando el storefront está en preview mode:

```astro
---
// src/layouts/BaseLayout.astro
import { CmsPreviewBridge } from '@proxima-io/storefront-builder-sdk';
import { isCmsPreview } from '@proxima-io/storefront-cms';

const isPreview = isCmsPreview(Astro.url);
---

<body>
  <!-- Solo active en preview; noop en producción -->
  <CmsPreviewBridge enabled={isPreview} />
  <slot />
</body>
```

### ¿Cómo detecta el preview mode?

`isCmsPreview(url)` devuelve `true` si la URL contiene `?proxima_preview=1`
(o el query param configurado). El Builder siempre añade este param al cargar
el iframe.

En producción el param no existe → `isPreview = false` → cero overhead.

---

## `EditableSection` — Seleccionar una sección

Envuelve **toda** la sección. Al hacer click, el Builder selecciona esa sección
en el árbol lateral.

```astro
---
import { EditableSection } from '@proxima-io/storefront-builder-sdk';
import type { CmsSection } from '@proxima-io/storefront-cms';

interface Props { section: CmsSection }
const { section } = Astro.props;
---

<EditableSection {section}>
  <section class="hero">
    <!-- contenido -->
  </section>
</EditableSection>
```

En producción (sin `CmsPreviewBridge`), `EditableSection` es un pass-through
transparente — no añade ningún DOM extra ni scripts.

---

## `EditableAttribute` — Editar un campo

Envuelve un elemento editable. Al hacer click, el Builder abre el editor del campo.

```astro
<EditableSection {section}>
  <section class="hero">

    <EditableAttribute {section} attributeKey="headline">
      <h1>{section.values.headline}</h1>
    </EditableAttribute>

    <EditableAttribute {section} attributeKey="subheadline">
      <p>{section.values.subheadline}</p>
    </EditableAttribute>

  </section>
</EditableSection>
```

> En el golden template los componentes reciben props desde `SectionRenderer` (`heading={section.values.headline}`) y usan `getSectionAttr(attributesMeta)` — ver intro arriba.

**Regla:** No envolver todo con `EditableAttribute` — solo los elementos que
el comercio debe poder editar individualmente. Un elemento con `EditableAttribute`
puede contener múltiples elementos HTML; el click en cualquiera de ellos abre el
editor de ese atributo.

---

## `EditableItem` — Editar un item de un array

Para atributos de tipo `array`, cada item tiene su propio editor.
`EditableItem` le dice al Builder cuál item está siendo editado:

```astro
---
const { features = [] } = section.values ?? {};
---

<EditableSection {section}>
  <div class="features">
    {features.map((feature, index) => (
      <EditableItem {section} attributeKey="features" itemIndex={index}>
        <article class="feature-card">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </article>
      </EditableItem>
    ))}
  </div>
</EditableSection>
```

---

## Props de los componentes builder

| Componente | Props | Descripción |
|-----------|-------|-------------|
| `EditableSection` | `section: CmsSection` | La sección completa |
| `EditableAttribute` | `section: CmsSection`, `attributeKey: string` | Nombre del campo en `section.values` |
| `EditableItem` | `section: CmsSection`, `attributeKey: string`, `itemIndex: number` | Para arrays, el índice del item |

---

## Cómo funciona internamente

### En preview mode:

1. `CmsPreviewBridge` escucha mensajes del Builder (parent)
2. `EditableSection` añade `data-proxima-section-id={section.id}` al DOM
3. `EditableAttribute` añade `data-proxima-attribute={attributeKey}` al DOM
4. Al hacer click en un elemento, el bridge detecta el atributo más cercano
   y envía un `postMessage` al Builder con `{ sectionId, attributeKey }`
5. El Builder resalta la sección y abre el editor del atributo

### Actualización en tiempo real:

Cuando el comercio edita un campo:
1. El Builder envía `{ type: "PROXIMA_PATCH", sectionId, attributeKey, value }` al iframe
2. `CmsPreviewBridge` intercepta el mensaje
3. El bridge actualiza el DOM directamente para campos simples (text, rich_text, image)
4. Para cambios complejos (smart_collection, array), el bridge fuerza un reload del iframe

---

## postMessage — protocolo completo

Si necesitas reaccionar a eventos del Builder en tu código client-side:

```ts
// src/components/SomeInteractiveComponent.ts
window.addEventListener('message', (event) => {
  // Verificar origen
  if (!event.origin.includes('proxima')) return;

  const { type, payload } = event.data ?? {};

  switch (type) {
    case 'PROXIMA_SECTION_SELECTED':
      // El Builder seleccionó una sección
      // payload: { sectionId: number }
      break;

    case 'PROXIMA_ATTRIBUTE_UPDATED':
      // El Builder actualizó un atributo
      // payload: { sectionId: number, attributeKey: string, value: unknown }
      break;

    case 'PROXIMA_SECTION_ADDED':
      // El comercio añadió una nueva sección
      // El bridge hace reload automáticamente
      break;

    case 'PROXIMA_PREVIEW_READY':
      // El Builder está listo para recibir eventos del storefront
      break;
  }
});
```

> La mayoría de storefronts no necesitan escuchar estos eventos directamente.
> `CmsPreviewBridge` lo maneja internamente.

---

## Atributos de imagen — edición inline

Las imágenes con `type: "image"` se editan con click en el Builder.
Para que el Builder pueda mostrar el overlay de edición en la imagen:

```astro
<EditableAttribute {section} attributeKey="banner_image">
  <!-- La imagen debe estar DENTRO del EditableAttribute -->
  {section.values.banner_image
    ? <img src={section.values.banner_image} alt="Banner" />
    : <div class="placeholder">Sin imagen</div>
  }
</EditableAttribute>
```

---

## Preview mode — comportamientos especiales

En preview mode, el storefront puede necesitar mostrar placeholders para
atributos vacíos:

```astro
---
import { isCmsPreview } from '@proxima-io/storefront-cms';
const isPreview = isCmsPreview(Astro.url);
const { headline } = section.values ?? {};
---

<EditableAttribute {section} attributeKey="headline">
  <h1 class:list={[{ 'is-empty': !headline && isPreview }]}>
    {headline || (isPreview ? '— Añadir título —' : '')}
  </h1>
</EditableAttribute>

<style>
  .is-empty {
    border: 2px dashed #ccc;
    color: #aaa;
    padding: 0.5rem;
    min-height: 2rem;
  }
</style>
```

---

## Secciones sin edición (header, footer)

Si una sección tiene atributos muy complejos o no necesita edición inline,
puedes usar solo `EditableSection` sin `EditableAttribute`:

```astro
<EditableSection {section}>
  <!-- Todo el contenido del header aquí, sin EditableAttribute -->
  <!-- El comercio edita los atributos del header desde el panel lateral -->
  <header>...</header>
</EditableSection>
```

---

---

## Preview de campaigns (content variants)

El Builder puede cargar el iframe con un `variant_id` para que el comercio vea
una campaña en draft antes de publicarla (e.g. "Día de la Madre").

### URL que envía el Builder

```
{storefront_url}{path}?cms_preview=1&api=1
  &builder_business_id={uuid}
  &builder_website_id={uuid}
  &builder_origin={origin}
  &variant_id={uuid}         ← presente solo en campaign preview
  &preview_token={secret}    ← presente solo en campaign preview
```

Cuando `variant_id` **no está**, es un preview de edición live normal.
Cuando `variant_id` **sí está**, el storefront debe servir el snapshot del campaign.

### Cómo pasar los params a la composición

`fetchProximaComposition` acepta `variantId` y `previewToken` en `ProximaApiConfig`:

```ts
import { fetchProximaComposition } from '@proxima-io/storefront-core';

const url = new URL(Astro.request.url);
const variantId    = url.searchParams.get("variant_id")    ?? undefined;
const previewToken = url.searchParams.get("preview_token") ?? undefined;

// Si hay variant_id sin preview_token → mostrar error, no llamar a la API
if (variantId && !previewToken) {
  // renderizar error UI
}

const composition = await fetchProximaComposition(
  { ...proximaConfig, path, variantId, previewToken },
  website
);
// La API devuelve el mismo PageCompositionResponse, pero con valores del snapshot
```

Reglas de la API:
- `variant_id` + token válido → composición desde el **snapshot del campaign**
- `variant_id` + token inválido/ausente → **401** `INVALID_PREVIEW_TOKEN`
- Sin `variant_id` → composición live normal

### Comportamientos requeridos con variant preview

| Qué | Cómo |
|-----|------|
| No cachear | `Cache-Control: no-store` cuando `variantId` está presente |
| No indexar | `<meta name="robots" content="noindex">` |
| No persistir el token | Nunca a localStorage/sessionStorage |
| Mostrar banner | "Vista previa de campaña — no publicada" |
| Preservar params en navegación | `variant_id` y `preview_token` deben seguir en cada path interno |
| Error 401 | Mensaje claro: "Enlace expirado — reabrir desde el Builder" |

### El postMessage bridge sigue funcionando

`cms:ready`, selección de secciones, `cms:apply-draft`, navigate mode — todo
funciona igual en campaign preview. Los `data-cms-editable` no se tocan.

---

## Cache de composiciones en el proceso Astro

Cada storefront en modo live cachea internamente las respuestas de la API usando
`websiteCache` y `compositionCache` — singletons por proceso Node.js exportados
desde `@proxima-io/storefront-core`.

```
Request → resolver.ts → compositionCache.get(path) → hit: HTML inmediato
                                                    → miss: fetch API → cache → HTML
```

TTLs por defecto:

| Cache | TTL | Qué guarda |
|-------|-----|-----------|
| `websiteCache` | 5 min | Config del website (shell, theme, capabilities) |
| `compositionCache` | 60 s | Composition de cada path (secciones CMS) |

### Invalidación activa — POST /api/cache/invalidate

La API de Proxima llama a este endpoint **fire-and-forget** después de cada save
en el Builder. Sin él, el merchant tiene que esperar hasta que expire el TTL.

Añadir en **cada storefront**:

```ts
// src/pages/api/cache/invalidate.ts
import type { APIRoute } from "astro";
import { handleCacheInvalidateWebhook } from "@proxima-io/storefront-core";

export const POST: APIRoute = ({ request }) =>
  handleCacheInvalidateWebhook(request, import.meta.env.PROXIMA_WEBHOOK_SECRET);
```

Y en el resolver (`src/lib/resolver.ts`), envolver los fetch calls:

```ts
import { compositionCache, websiteCache } from "@proxima-io/storefront-core";

// En resolveRequest — website config
const cached = !isBuilderPreview ? websiteCache.get(domain) : null;
if (cached) {
  apiWebsite = cached;
} else {
  apiWebsite = await fetchProximaWebsite({ baseUrl, domain, host: domain, serviceKey });
  if (!isBuilderPreview) websiteCache.set(domain, apiWebsite);
}

// En resolveRequest — composition
let cacheHit = false;
const cachedComp = !isBuilderPreview ? compositionCache.get(path) : null;
if (cachedComp) {
  composition = cachedComp;
  cacheHit = true;
} else {
  composition = await fetchProximaComposition({ baseUrl, domain, path, serviceKey }, apiWebsite);
  if (!isBuilderPreview) compositionCache.set(path, composition);
}
```

### Scopes del webhook

| `scope` | `path` | Efecto |
|---------|--------|--------|
| `"composition"` | `/ruta` | Flush solo esa página |
| `"website"` | — | Flush website config + todas las composiciones |
| `"all"` | — | Flush todo |

### Regla crítica: Builder preview siempre fresco

El cache se salta cuando `isBuilderPreview === true` (parámetro `cms_preview=1`
o `builder_website_id` en la URL). El merchant debe ver sus cambios al instante
— nunca una versión cacheada.

### Env var requerida

```env
# Debe coincidir con STOREFRONT_WEBHOOK_SECRET en la API de Proxima
PROXIMA_WEBHOOK_SECRET=your-secret-here
```

Si la variable no está definida, el endpoint acepta el webhook sin autenticación
(seguro en dev detrás de firewall; **siempre configurar en prod**).

---

## Checklist de Builder Integration

- [ ] `CmsPreviewBridge` está en `SiteLayout.astro` (o layout base) con `enabled={isPreview}`
- [ ] `isCmsPreview(Astro.url)` determina `isPreview`
- [ ] Cada sección tiene `<EditableSection {section}>`
- [ ] Cada campo editable tiene `<EditableAttribute {section} attributeKey="...">`
- [ ] Cada item de array tiene `<EditableItem {section} attributeKey="..." itemIndex={i}>`
- [ ] En producción, no hay overhead del builder (todo es noop)
- [ ] Campaign preview: `variantId` + `previewToken` se pasan a `fetchProximaComposition`
- [ ] `variant_id` sin `preview_token` falla cerrado (error UI, no silent fallback)
- [ ] URLs con `preview_token` tienen `Cache-Control: no-store` y `noindex`
- [ ] `POST /api/cache/invalidate` existe en el storefront (usa `handleCacheInvalidateWebhook`)
- [ ] `compositionCache` y `websiteCache` envuelven los fetch calls en `resolver.ts`
- [ ] `PROXIMA_WEBHOOK_SECRET` configurado en prod
