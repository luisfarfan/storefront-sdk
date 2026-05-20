## ADDED Requirements

### Requirement: Eliminar paquetes locales del template-catalog

`proxima-website-template-catalog/packages/` SHALL ser eliminado completamente. Los directorios `proxima-template-schema`, `template-registry-client`, `templateizer` SHALL dejar de existir en el repo.

#### Scenario: Directorio packages eliminado
- **WHEN** se lista `proxima-website-template-catalog/`
- **THEN** no existe el directorio `packages/`

### Requirement: pnpm-workspace.yaml actualizado

`pnpm-workspace.yaml` SHALL eliminar la entrada `packages/*` ya que no quedan paquetes propios. SHALL mantener solo `templates/*` y `apps/*` si aplica.

#### Scenario: Workspace sin paquetes huérfanos
- **WHEN** se ejecuta `pnpm install` en `proxima-website-template-catalog`
- **THEN** pnpm no intenta resolver workspaces bajo `packages/`

### Requirement: Scripts raíz actualizados

El `package.json` raíz SHALL actualizar el script `validate` para invocar el CLI del SDK directamente en lugar del workspace local. SHALL agregar `@proxima/templateizer` como devDependency apuntando al SDK con `file:`.

#### Scenario: CLI disponible desde el SDK
- **WHEN** se ejecuta `pnpm validate` en `proxima-website-template-catalog`
- **THEN** se ejecuta `proxima-templateizer validate` usando el CLI del SDK

### Requirement: Templates siguen siendo válidos

Los templates en `templates/ecommerce-standard/` SHALL seguir validando correctamente con el CLI del SDK.

#### Scenario: Validación del template existente
- **WHEN** se ejecuta `proxima-templateizer validate templates/ecommerce-standard`
- **THEN** imprime `Valid manifest` y retorna código 0
