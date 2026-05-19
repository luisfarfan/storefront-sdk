## ADDED Requirements

### Requirement: Normalización de secciones CMS

`@proxima/storefront-cms` SHALL exportar `normalizeCmsSection(section: unknown): CmsSectionRecord` que transforma una sección raw de la API (snake_case o camelCase) a un formato normalizado con `id`, `type`, `name`, `attributes`, y `attributes_meta`.

SHALL también exportar `normalizeCmsSections(sections: unknown[]): CmsSectionRecord[]` para arrays.

#### Scenario: Normaliza snake_case de la API
- **WHEN** se llama con `{ id: 1, type: "hero_split", attributes: { heading: "Hola" }, attributes_meta: { heading: { type: "text" } } }`
- **THEN** retorna `CmsSectionRecord` con `id: 1`, `type: "hero_split"`, `attributes.heading: "Hola"`, y `attributes_meta.heading.type: "text"`

#### Scenario: Normaliza camelCase
- **WHEN** se llama con `{ attributesMeta: { heading: { attributeKey: "heading" } } }`
- **THEN** retorna con `attributes_meta.heading.attribute_key: "heading"`

#### Scenario: Input inválido retorna vacío
- **WHEN** se llama con `null`, `undefined`, o un no-objeto
- **THEN** retorna `{ id: "", type: "", attributes: {} }` sin lanzar error

### Requirement: Detección de preview CMS

`@proxima/storefront-cms` SHALL exportar `isCmsPreview(url: URL): boolean` que retorna `true` si `cms_preview=1` está en los search params.

SHALL exportar `getPreviewRobots(robots: string, preview: boolean): string` que retorna `"noindex,nofollow"` cuando `preview` es `true`.

#### Scenario: Detecta preview activo
- **WHEN** la URL contiene `?cms_preview=1`
- **THEN** `isCmsPreview` retorna `true`

#### Scenario: Sin preview
- **WHEN** la URL no contiene `cms_preview`
- **THEN** `isCmsPreview` retorna `false`

### Requirement: Resolución de tenant CMS

`@proxima/storefront-cms` SHALL exportar `resolveCmsTenantFromUrl(url: URL, fallback: CmsTenantIds): CmsTenantIds`. En modo preview, lee `builder_website_id`/`website_id` y `builder_business_id`/`business_id` de los query params. Fuera de preview, retorna el fallback sin leer query params.

#### Scenario: Override en preview
- **WHEN** `cms_preview=1` y la URL tiene `builder_website_id=abc`
- **THEN** retorna `{ websiteId: "abc", businessId: fallback.businessId }`

#### Scenario: Sin override fuera de preview
- **WHEN** la URL no tiene `cms_preview=1`
- **THEN** retorna el fallback sin leer los query params

### Requirement: Factory de cliente API

`@proxima/storefront-cms` SHALL exportar `createStorefrontApiClient(tenant: CmsTenantIds, opts: StorefrontApiClientOptions)` que retorna un cliente con métodos para todos los endpoints del storefront de Proxima: `getCmsPage`, `getProduct`, `getCategoryPage`, `getCategoryListing`, `getBrandPage`, `getBrandListing`, `getProductsListing`, `searchProducts`.

El cliente SHALL enviar headers `X-Business-ID`, `Accept-Language`, y `X-Currency` en cada request.

#### Scenario: Headers correctos
- **WHEN** se llama `getHomePage("es")`
- **THEN** el request HTTP incluye `X-Business-ID: <businessId>`, `Accept-Language: es`, `X-Currency: <currency>`

#### Scenario: Error de API lanza excepción
- **WHEN** la API retorna un status 4xx o 5xx
- **THEN** el método lanza un `Error` con el mensaje del campo `detail` de la respuesta

### Requirement: Helpers de shell sections

`@proxima/storefront-cms` SHALL exportar `getShellSectionMap(pageId, sections): CmsShellSectionMap` que extrae las secciones de tipo `ticker`, `header`, `mega_menu`, y `footer` de un array de secciones.

SHALL exportar `resolveCmsCompositionPageId(composition: unknown): number | string | null` que extrae el `page_id` de una respuesta de composición en cualquiera de sus formas (`page.id`, `page_id`, `pageId`).

#### Scenario: Extrae secciones de shell
- **WHEN** el array de secciones contiene una de type `"header"` y una de type `"footer"`
- **THEN** `getShellSectionMap` retorna `{ header: CmsSectionMeta, footer: CmsSectionMeta, ticker: undefined, mega_menu: undefined }`
