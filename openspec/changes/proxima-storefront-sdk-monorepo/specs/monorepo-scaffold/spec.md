## ADDED Requirements

### Requirement: Estructura base del monorepo

El repo SHALL contener la siguiente estructura raíz:
- `package.json` raíz con `"packageManager": "pnpm@10.x"`, `"workspaces": ["packages/*"]`, y scripts `build`, `test`, `typecheck`, `lint`.
- `pnpm-workspace.yaml` declarando `packages: ["packages/*"]`.
- `turbo.json` con tasks `build`, `test`, `typecheck`, cada uno con `"dependsOn": ["^build"]`.
- `tsconfig.base.json` raíz con `strict: true`, `moduleResolution: bundler`, `target: ES2022`, `module: ESNext`.
- `.gitignore` que excluye `node_modules`, `dist`, `.turbo`, `.proxima/registry`.

#### Scenario: Build en orden de dependencias
- **WHEN** se ejecuta `turbo build` en la raíz
- **THEN** Turborepo buildea primero `template-schema` y `template-registry-client`, luego `templateizer`; y `storefront-cms`, `storefront-core`, `storefront-commerce` antes que cualquier paquete que los consuma

#### Scenario: Caché de Turborepo
- **WHEN** se ejecuta `turbo build` dos veces sin cambios
- **THEN** el segundo build usa caché local y no re-ejecuta ningún paso

### Requirement: Cada paquete es independientemente publicable

Cada paquete SHALL tener su propio `package.json` con:
- `"name": "@proxima/<nombre>"` bajo el scope `@proxima`.
- `"version"` semántico inicial `"0.1.0"`.
- `"exports"` con entry points explícitos.
- `"files"` listando solo los artefactos de distribución (`dist/`, `src/` si distribuye source, `*.astro` si aplica).
- `"scripts": { "build": "...", "typecheck": "...", "test": "..." }`.

#### Scenario: Instalación selectiva
- **WHEN** un storefront instala `@proxima/storefront-cms`
- **THEN** no recibe `@proxima/templateizer` ni `@proxima/template-schema` como dependencias transitivas

### Requirement: TypeScript compartido y estricto

El monorepo SHALL tener un `tsconfig.base.json` raíz. Cada paquete SHALL extender ese base con `"extends": "../../tsconfig.base.json"`. La compilación SHALL fallar con errores de tipo antes de emitir artefactos.

#### Scenario: Error de tipo bloquea build
- **WHEN** un paquete tiene un error de TypeScript
- **THEN** `turbo build` falla con código de salida no-cero y muestra el error
