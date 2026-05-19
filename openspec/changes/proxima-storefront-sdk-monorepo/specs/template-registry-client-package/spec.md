## ADDED Requirements

### Requirement: Cliente HTTP para el registry de templates

`@proxima/template-registry-client` SHALL exportar la clase `TemplateRegistryClient` que encapsula todos los calls HTTP a los endpoints admin de `proxima-api` para website templates.

El constructor SHALL requerir `apiUrl` (vía opción o `PROXIMA_API_URL` env) y `token` (vía opción o `PROXIMA_API_TOKEN` env). SHALL lanzar `RegistryClientError` si alguno falta.

SHALL exponer los métodos:
- `listAdminTemplates(): Promise<WebsiteTemplateRecord[]>` — GET `/api/v1/admin/cms/website-templates`
- `listCatalogTemplates(): Promise<WebsiteTemplateRecord[]>` — GET `/api/v1/storefront/cms/website-templates`
- `findTemplate({ templateKey?, slug? }): Promise<WebsiteTemplateRecord | null>` — busca por `template_key` primero, luego por `slug`
- `createTemplate(payload): Promise<WebsiteTemplateRecord>` — POST
- `updateTemplate(id, payload): Promise<WebsiteTemplateRecord>` — PATCH
- `patchDeployment(id, deploymentConfig): Promise<WebsiteTemplateRecord>` — PATCH solo `deployment_config`
- `publishTemplate(id): Promise<WebsiteTemplateRecord>` — PATCH `publication_status: "published"`
- `isVisibleInCatalog(id): Promise<boolean>` — verifica si el template aparece en el catálogo público

#### Scenario: Autenticación con Bearer token
- **WHEN** se realiza cualquier request
- **THEN** incluye el header `Authorization: Bearer <token>`

#### Scenario: Error HTTP lanza RegistryClientError
- **WHEN** la API retorna un status 4xx o 5xx
- **THEN** lanza `RegistryClientError` con `status` y `responseText` (con token redactado)

#### Scenario: Token redactado en errores
- **WHEN** la respuesta de error contiene el token en el body
- **THEN** `RegistryClientError.responseText` tiene el token reemplazado por `[REDACTED]`

### Requirement: Fetch injectable para testing

`TemplateRegistryClient` SHALL aceptar `fetchImpl?: typeof fetch` en el constructor para permitir inyección de un fetch mockeado en tests sin dependencias de red.

#### Scenario: Mock de fetch en tests
- **WHEN** se construye `TemplateRegistryClient` con un `fetchImpl` personalizado
- **THEN** todos los requests usan ese fetch en lugar del global

### Requirement: Tipos exportados del registry

`@proxima/template-registry-client` SHALL exportar:
- `WebsiteTemplateRecord` — tipo de un template registrado en la API
- `RegistryClientOptions` — opciones del constructor
- `RegistryClientError` — clase de error con `status` y `responseText`

#### Scenario: Tipos usables en el CLI
- **WHEN** `@proxima/templateizer` importa `WebsiteTemplateRecord` de `@proxima/template-registry-client`
- **THEN** puede tipar las respuestas del registry sin redefinir los tipos
