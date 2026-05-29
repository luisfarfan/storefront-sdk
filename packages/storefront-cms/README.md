# @proxima-io/storefront-cms

Utilidades CMS para storefronts Proxima — normalización de secciones, resolución de tenant, detección de preview y factory del cliente de API.

Usado internamente por `@proxima-io/storefront-core` y `@proxima-io/storefront-builder-sdk`. En la mayoría de los casos no necesitas importarlo directamente.

## Instalación

```bash
pnpm add @proxima-io/storefront-cms
```

## Qué exporta

### `normalizeCmsSections(sections)`

Normaliza el array de secciones CMS que devuelve la API — asegura que los atributos estén en el formato correcto para ser consumidos por los componentes Astro.

### `resolve-cms-tenant`

Funciones para resolver el tenant CMS desde el contexto de request. Maneja la lógica de dominio → website → business.

### `cms-preview`

Detecta si el storefront está siendo visualizado desde el Builder de Proxima en modo preview, y expone helpers para adaptar el comportamiento (e.g. deshabilitar cache, mostrar overlays de edición).

### `create-storefront-api-client`

Factory que crea el cliente HTTP configurado con el `apiUrl`, `serviceKey` y contexto correcto para las llamadas server-side.

### `merge-product-item-overrides`

Fusiona los overrides de atributos de producto definidos en el CMS con los datos del catálogo. Permite que el comercio personalice nombre, imagen y descripción por producto desde el Builder.

## Relación con otros paquetes

```
storefront-core
  └── usa storefront-cms para normalización y resolución de tenant

storefront-builder-sdk
  └── usa storefront-cms para detección de preview y meta de secciones
```
