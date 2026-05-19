## ADDED Requirements

### Requirement: CLI ejecutable como bin

`@proxima/templateizer` SHALL tener un entry point `bin` declarado en `package.json` como `"proxima-templateizer": "./dist/index.js"`. El script SHALL tener shebang `#!/usr/bin/env node` y ser ejecutable.

#### Scenario: Ejecución directa
- **WHEN** se ejecuta `proxima-templateizer --help`
- **THEN** imprime la lista de comandos disponibles y retorna código 0

#### Scenario: Comando inválido
- **WHEN** se ejecuta `proxima-templateizer unknown-command`
- **THEN** imprime help y retorna código 1

### Requirement: Comando validate

`proxima-templateizer validate <target>` SHALL buscar todos los `proxima.template.json` bajo `<target>`, validarlos con `@proxima/template-schema`, imprimir el resultado por archivo, y retornar código 0 si todos son válidos o código 1 si alguno falla.

#### Scenario: Manifest válido
- **WHEN** se ejecuta contra un directorio con un manifest válido
- **THEN** imprime `Valid manifest: <path>` y retorna código 0

#### Scenario: Manifest inválido
- **WHEN** el manifest tiene errores
- **THEN** imprime `Invalid manifest: <path>` seguido de cada issue con su ruta, y retorna código 1

### Requirement: Comando register

`proxima-templateizer register <target> [--dry-run] [--api-url <url>] [--token <token>]` SHALL:
- Cargar y parsear el `proxima.template.json` del target.
- Buscar si ya existe un template con el mismo `template_key` o `slug` en la API.
- Si no existe: crear (POST) con `publication_status: "draft"`.
- Si existe: actualizar (PATCH).
- Guardar estado local en `.proxima/registry/<template_key>.json` con `template_id`, `last_registered_at`, y hash del payload.
- Con `--dry-run`: imprimir el JSON de la acción planeada sin llamar a la API.

#### Scenario: Primer registro
- **WHEN** el template no existe en la API
- **THEN** crea el template, imprime `{ "action": "created", "template_id": "..." }`, y escribe el estado local

#### Scenario: Re-registro idempotente
- **WHEN** el template ya existe (mismo `template_key`)
- **THEN** actualiza el template, imprime `{ "action": "updated", "template_id": "..." }`

#### Scenario: Dry run no llama a la API
- **WHEN** se pasa `--dry-run`
- **THEN** imprime el JSON de la acción planeada y retorna código 0 sin hacer ningún request HTTP

### Requirement: Comando deploy

`proxima-templateizer deploy <target> [--preview-url <url>] [--production-url <url>] [--build-id <id>] [--dry-run]` SHALL patchear el `deployment_config` de un template ya registrado. SHALL fallar si el template no está registrado (sin `template_id` local o sin encontrar en la API).

#### Scenario: Patchea deployment config
- **WHEN** se ejecuta con `--preview-url https://preview.example.com`
- **THEN** hace PATCH con `{ deployment_config: { preview_url: "https://preview.example.com" } }` y retorna el template actualizado

### Requirement: Comando publish

`proxima-templateizer publish <target> [--dry-run]` SHALL marcar un template registrado como `publication_status: "published"`. El template SHALL ser visible en el catálogo público después de publicar.

#### Scenario: Publicación exitosa
- **WHEN** el template está registrado como draft
- **THEN** hace PATCH con `{ publication_status: "published" }` e imprime `{ "action": "published" }`

### Requirement: Comando sync

`proxima-templateizer sync <target> [--publish] [--dry-run] [<deploy-flags>]` SHALL ejecutar en orden: validate → register → (deploy si hay flags de deploy) → (publish si `--publish`). Si algún paso falla, se detiene y retorna código no-cero.

#### Scenario: Sync completo con publish
- **WHEN** se ejecuta `sync <target> --publish`
- **THEN** valida, registra, y publica; retorna código 0 si todo pasa

### Requirement: Comando status

`proxima-templateizer status <target> [--dry-run]` SHALL mostrar el estado del template en el registry: `registered`, `template_id`, `publication_status`, `storefront_visible`, `deployment_config`.

#### Scenario: Status de template registrado
- **WHEN** el template existe en la API
- **THEN** imprime JSON con todos los campos de estado incluyendo si es visible en el catálogo

### Requirement: Artefactos de análisis

`proxima-templateizer scan|analyze|snapshot <target>` SHALL descubrir páginas, secciones, atributos y smart collections del template y escribir artefactos JSON en `.proxima/templateizer/`: `pages.json`, `sections.json`, `attributes.json`, `smart-collections.json`, `manifest.generated.json`, `report.md`.

#### Scenario: Generación de artefactos
- **WHEN** se ejecuta `analyze <target>`
- **THEN** escribe todos los artefactos en `.proxima/templateizer/` y retorna código 0
