## ADDED Requirements

### Requirement: Eliminar paquetes locales del PoC

`proxima-managed-storefront-poc/packages/` SHALL quedar vacío o eliminado. Los directorios `storefront-cms`, `storefront-core`, `storefront-commerce`, `storefront-builder-sdk` SHALL ser eliminados del repo.

#### Scenario: Paquetes locales eliminados
- **WHEN** se lista `proxima-managed-storefront-poc/packages/`
- **THEN** no existe ningún directorio `storefront-*`

### Requirement: Runtime apunta al SDK

`apps/managed-runtime/package.json` SHALL referenciar los 4 paquetes via `file:` apuntando al SDK:
- `"@proxima/storefront-cms": "file:../../../proxima-storefront-sdk/packages/storefront-cms"`
- `"@proxima/storefront-core": "file:../../../proxima-storefront-sdk/packages/storefront-core"`
- `"@proxima/storefront-commerce": "file:../../../proxima-storefront-sdk/packages/storefront-commerce"`
- `"@proxima/storefront-builder-sdk": "file:../../../proxima-storefront-sdk/packages/storefront-builder-sdk"`

#### Scenario: Dependencias resueltas desde el SDK
- **WHEN** se ejecuta `npm install` en `proxima-managed-storefront-poc`
- **THEN** `node_modules/@proxima/storefront-cms` enlaza al SDK en lugar de al paquete local eliminado

### Requirement: Workspaces raíz actualizados

El `package.json` raíz del PoC SHALL eliminar `"packages/*"` de su campo `workspaces` si ya no hay paquetes propios, o mantenerlo vacío.

#### Scenario: npm install sin errores
- **WHEN** se ejecuta `npm install` en la raíz del PoC
- **THEN** completa sin errores de workspace faltante

### Requirement: `normalizeCmsSections` disponible en el SDK

`@proxima/storefront-cms` SHALL exportar `normalizeCmsSections(sections: unknown[]): CmsSectionRecord[]` (plural) para mantener compatibilidad con el import existente en el PoC.

#### Scenario: Import existente sigue funcionando
- **WHEN** el runtime importa `{ normalizeCmsSections } from "@proxima/storefront-cms"`
- **THEN** TypeScript resuelve el símbolo sin error
