# @proxima-io/templateizer

CLI para gestionar storefronts y templates de Proxima — deploy de section types, páginas, estructura de templates y publicación en el Marketplace.

## Instalación

```bash
pnpm add -D @proxima-io/templateizer
# o globalmente
npm install -g @proxima-io/templateizer
```

## Setup rápido

```bash
# Wizard interactivo — crea .proxima/credentials.json y lo agrega al .gitignore
proxima-templateizer init
```

El archivo de credenciales es la forma recomendada de autenticarse. Alternativa: variables de entorno o `.env`.

## Comandos principales

### `website-deploy`

Despliega section types + scaffolding de páginas a un website específico de un cliente.

```bash
proxima-templateizer website-deploy [target]

# Opciones
--dry-run                  Muestra el payload sin llamar a la API
--force                    Aplica breaking changes sin confirmación interactiva
--yes, -y                  Salta la confirmación pre-deploy (útil en CI)
--page <path>              Despliega solo esta página (repetible: --page /a --page /b)
--domain <domain>          Override del dominio
--service-key <key>        Override del service key
--api-url <url>            Override de la URL de la API
--credentials <file.json>  Ruta a un archivo de credenciales JSON
```

**Comportamiento interactivo:**
- Antes de cada deploy muestra un resumen y pide confirmación (omitir con `--yes`)
- Si la API devuelve breaking changes (409), pregunta si deseas aplicarlos con `--force`
- Muestra un spinner animado durante la llamada a la API
- En CI (cuando `CI=1`, `GITHUB_ACTIONS=1` o `NO_INTERACTIVE=1`) todos los prompts se deshabilitan

### `init`

Wizard interactivo que crea `.proxima/credentials.json`.

```bash
proxima-templateizer init [target]
```

- Pregunta API URL, dominio, service key (input oculto) y template key (opcional)
- Usa valores existentes del `.env` como defaults
- Agrega `.proxima/credentials.json` al `.gitignore` automáticamente

### `validate`

Valida uno o varios archivos `proxima.template.json`.

```bash
proxima-templateizer validate [target]
```

### `template-create`

Crea o actualiza de forma idempotente un template en el registro de Proxima.

```bash
proxima-templateizer template-create [target] [opciones]

--dry-run                  Muestra el payload sin llamar a la API
--publish-manifest         Sube la estructura a S3 y parchea el pointer del manifiesto
--local-only               Omite el upload a S3
--name <string>            Nombre del template
--description <str>        Descripción corta para el marketplace
--category <str>           Categoría (default: ecommerce)
--pricing-tier <str>       Tier de precio: free | pro (default: free)
--demo-url <url>           URL de demo en vivo
--preview-image <url>      Imagen de preview
--tags <a,b,c>             Tags separadas por coma
--credentials <file.json>  Ruta a un archivo de credenciales JSON
```

### Otros comandos

| Comando | Descripción |
|---------|-------------|
| `register` | Crea o actualiza un draft WebsiteTemplate en proxima-api |
| `deploy` | Parchea el deployment_config de un template registrado |
| `publish` | Publica un template registrado |
| `sync` | validate → register → [deploy] → [publish] |
| `status` | Estado en el registro y visibilidad en el catálogo |
| `template-deploy` | [LEGACY] Pushea estructura inline a la columna de template |
| `template-publish` | Alias de `template-create --publish-manifest` |
| `scan` | Detecta páginas y archivos fuente |
| `analyze` | Infiere páginas, secciones, atributos y colecciones |
| `validate` | Valida el proxima.template.json |

## Credenciales

### Archivo JSON (recomendado)

```json
// .proxima/credentials.json
{
  "api_url":      "https://api.proxima.io",
  "service_key":  "pxa_live_...",
  "domain":       "mitienda.proxima.app",
  "template_key": "mi-template"
}
```

Crea este archivo con `proxima-templateizer init`. **Nunca lo commitees** — `init` lo agrega al `.gitignore` automáticamente.

Para usar un archivo en una ruta personalizada:

```bash
proxima-templateizer website-deploy --credentials ~/secrets/cliente-a.json
```

### Variables de entorno / `.env`

```env
PROXIMA_API_URL=https://api.proxima.io
PROXIMA_SERVICE_KEY=pxa_live_...
PROXIMA_DOMAIN=mitienda.proxima.app
PROXIMA_TEMPLATE_KEY=mi-template        # solo para comandos de template
PROXIMA_API_TOKEN=...                   # solo para comandos de template registry
S3_TEMPLATES_BUCKET=my-bucket          # solo para --publish-manifest
S3_TEMPLATES_REGION=us-east-1
```

### Prioridad de resolución

```
CLI flags  >  process.env  >  credentials JSON  >  .env
```

## Uso en CI

En entornos CI todos los prompts interactivos se deshabilitan automáticamente. Para no-CI puedes forzarlo:

```bash
NO_INTERACTIVE=1 proxima-templateizer website-deploy .
# o
proxima-templateizer website-deploy . --yes
```

Ejemplo de GitHub Actions:

```yaml
- name: Deploy website
  run: proxima-templateizer website-deploy .
  env:
    PROXIMA_API_URL: ${{ secrets.PROXIMA_API_URL }}
    PROXIMA_SERVICE_KEY: ${{ secrets.PROXIMA_SERVICE_KEY }}
    PROXIMA_DOMAIN: ${{ secrets.PROXIMA_DOMAIN }}
```

## Manifiestos

| Archivo | Para qué | Comando |
|---------|----------|---------|
| `proxima.website.json` | Deploy a un website específico de un cliente | `website-deploy` |
| `proxima.template.json` | Publicar en el Proxima Marketplace | `register`, `publish`, `sync` |

No confundirlos. Un storefront de cliente solo necesita `proxima.website.json`.

## Ver ayuda completa

```bash
proxima-templateizer
proxima-templateizer --help
```
