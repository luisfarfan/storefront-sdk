## ADDED Requirements

### Requirement: Resolución de website por dominio

`@proxima/storefront-core` SHALL exportar `fetchProximaWebsite(config: ProximaApiConfig): Promise<ProximaWebsiteResponse>` que hace GET a `/api/v1/storefront/cms/websites/resolve?domain=<domain>` y retorna la configuración completa del website: `id`, `business_id`, `name`, `domain`, `delivery_mode`, `website_kind`, `capabilities`, `theme_tokens`, `animation_config`.

#### Scenario: Resolución exitosa
- **WHEN** se llama con un dominio válido registrado en la API
- **THEN** retorna `ProximaWebsiteResponse` con todos los campos del website

#### Scenario: Dominio no encontrado
- **WHEN** el dominio no existe en la API
- **THEN** lanza un error con el status HTTP de la respuesta

### Requirement: Obtención de composición de página

`@proxima/storefront-core` SHALL exportar `fetchProximaComposition(config: ProximaApiConfig, website: ProximaWebsiteResponse): Promise<ProximaCompositionResponse>` que hace GET a `/api/v1/storefront/cms/websites/{id}/pages/composition?path=<path>` con headers `X-Business-ID`, `Accept-Language: es`, `X-Currency`.

#### Scenario: Composición exitosa
- **WHEN** se llama con un path válido
- **THEN** retorna la composición con `page_id` y array de `sections` con `attributes` y `attributes_meta`

### Requirement: Listado de productos

`@proxima/storefront-core` SHALL exportar `fetchProximaProducts(config: ProximaApiConfig, website: ProximaWebsiteResponse): Promise<ProximaProductListResponse>` que hace GET a `/api/v1/products?size=12` con los headers de tenant.

#### Scenario: Lista de productos
- **WHEN** se llama con un website válido
- **THEN** retorna un array de productos con `id`, `slug`, `name`, `price`, `images`

### Requirement: Constructor de preview para Builder

`@proxima/storefront-core` SHALL exportar `makeBuilderPreviewWebsite(opts: { websiteId: string, businessId: string, domain: string }): ProximaWebsiteResponse` que construye un objeto de website sintético para el modo preview del Builder sin necesidad de llamar a la API.

#### Scenario: Website sintético para preview
- **WHEN** se llama con `websiteId`, `businessId`, y `domain`
- **THEN** retorna un `ProximaWebsiteResponse` con capabilities vacías y theme tokens por defecto, listo para ser usado por el resolver
