## ADDED Requirements

### Requirement: Detección de resolver de commerce

`@proxima/storefront-commerce` SHALL exportar `isCommerceResolver(kind: ResolverKind): boolean` que retorna `true` para los resolvers `cart`, `checkout`, `buyer_login`, y `buyer_account`.

#### Scenario: Resolver de commerce
- **WHEN** se llama con `"cart"`, `"checkout"`, `"buyer_login"`, o `"buyer_account"`
- **THEN** retorna `true`

#### Scenario: Resolver de contenido
- **WHEN** se llama con `"content_page"`, `"product_list"`, o `"product_detail"`
- **THEN** retorna `false`

### Requirement: Tipos compartidos de commerce

`@proxima/storefront-commerce` SHALL exportar los tipos centrales de la plataforma:
- `DeliveryMode`: `"managed_template" | "external_headless" | "custom_managed"`
- `WebsiteKind`: `"landing" | "catalog" | "ecommerce"`
- `ResolverKind`: `"content_page" | "product_list" | "product_detail" | "cart" | "checkout" | "buyer_login" | "buyer_account"`
- `WebsiteCapabilities`: objeto con flags `cms_pages`, `catalog`, `cart`, `checkout`, `buyer_auth`, `orders`, `payments`
- `ThemeTokens`: tokens de color, tipografía, radius, density
- `AnimationConfig`: `motion`, `reveal`, `stagger`

#### Scenario: Tipos exportados y usables
- **WHEN** un storefront importa `@proxima/storefront-commerce`
- **THEN** puede usar los tipos sin redefinirlos localmente
