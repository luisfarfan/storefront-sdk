## ADDED Requirements

### Requirement: Eliminar paquete storefront-cms local de la 214store

`proxima-214store/packages/storefront-cms/` SHALL ser eliminado. El `package.json` raíz SHALL reemplazar `"@proxima/storefront-cms": "workspace:*"` por `"@proxima/storefront-cms": "file:../proxima-storefront-sdk/packages/storefront-cms"`.

#### Scenario: Paquete local eliminado
- **WHEN** se lista `proxima-214store/packages/`
- **THEN** no existe el directorio `storefront-cms`

### Requirement: workspaces raíz actualizado

El `package.json` raíz de la 214store SHALL eliminar la entrada `"packages/*"` de `workspaces` ya que no quedan paquetes propios, o bien mantener el campo con array vacío.

#### Scenario: npm install sin errores
- **WHEN** se ejecuta `npm install` en la raíz de la 214store
- **THEN** completa sin errores y `node_modules/@proxima/storefront-cms` enlaza al SDK

### Requirement: Imports existentes siguen funcionando

El código fuente de la 214store que importa de `@proxima/storefront-cms` SHALL seguir compilando sin cambios — los símbolos que usa (`isCmsPreview`, `normalizeCmsSection`, `resolveCmsTenantFromUrl`, `createStorefrontApiClient`, etc.) están todos exportados desde el SDK.

#### Scenario: TypeScript compila sin errores
- **WHEN** se ejecuta `npm run build` o `tsc` en la 214store
- **THEN** no hay errores de tipo relacionados con `@proxima/storefront-cms`
