## ADDED Requirements

### Requirement: Bridge postMessage con Proxima Builder

`@proxima/storefront-builder-sdk` SHALL exportar el componente Astro `CmsPreviewBridge.astro` que, cuando `enabled=true`, inyecta un script inline que establece comunicación bidireccional con el Builder de Proxima via `window.postMessage`.

El bridge SHALL manejar los siguientes mensajes entrantes del Builder:
- `cms:set-highlight` — resalta visualmente una sección y opcionalmente un atributo
- `cms:clear-highlight` — quita el resaltado
- `cms:set-tree-hover-section` — resaltado de hover desde el árbol de páginas
- `cms:set-mode` — cambia entre modo `edit` y `navigate`
- `cms:set-content-zoom` — aplica zoom CSS al `document.documentElement`
- `cms:apply-draft` — aplica cambios de borrador al DOM sin reload (merge)
- `cms:replace-draft-state` — reemplaza todo el estado de borrador
- `cms:clear-draft` — limpia los cambios del borrador del DOM
- `cms:refresh-preview` — recarga la página

El bridge SHALL enviar los siguientes mensajes al Builder:
- `cms:ready` — al cargar, con info de path, lang, preview mode, y draft support
- `cms:select-section` — al hacer click en una sección editable
- `cms:select-attribute` — al hacer click en un atributo específico
- `cms:select-item` — al hacer click en un ítem de array/colección
- `cms:hover-section` — al hacer mouseover en una sección editable
- `cms:navigate-request` — al hacer click en un link interno

#### Scenario: Comunicación segura por origen
- **WHEN** el bridge recibe un mensaje
- **THEN** verifica que el `event.source === window.parent` y que `event.origin` coincide con el `builderTargetOrigin` antes de procesar

#### Scenario: Apply draft al DOM sin reload
- **WHEN** se recibe `cms:apply-draft` con `changes: [{ attributeKey: "heading", value: "Nuevo título" }]`
- **THEN** el elemento con `data-cms-attribute-key="heading"` actualiza su contenido en el DOM sin reload y se marca con `data-cms-draft-applied="true"`

#### Scenario: Draft soporta tipos atómicos
- **WHEN** se aplica un draft con `attributeType: "image"`
- **THEN** el `src` del `<img>` se actualiza; con `attributeType: "link"`, el `href` y el texto del `<a>` se actualizan

#### Scenario: Zoom CSS
- **WHEN** se recibe `cms:set-content-zoom` con `scale: 0.75`
- **THEN** `document.documentElement` recibe `transform: scale(0.75)`, `transform-origin: 0 0`, y `width: 133.33%`

### Requirement: Componentes Astro editables

`@proxima/storefront-builder-sdk` SHALL exportar tres componentes Astro que marcan el DOM con atributos `data-cms-*`:

**EditableSection** — envuelve una sección entera:
- Props: `enabled`, `pageId`, `sectionId`, `sectionType`, `sectionName`, `as`, `class`
- Cuando `enabled=true` y `sectionId` está presente: renderiza el tag con `data-cms-editable="true"`, `data-cms-section-id`, `data-cms-section-type`, `data-cms-section-name`
- Cuando `enabled=false` o sin `sectionId`: renderiza solo el slot sin atributos CMS

**EditableAttribute** — envuelve un campo editable:
- Props: `enabled`, `name`, `attributeKey`, `type`, `label`, `as`, `class`, `href`
- Cuando `enabled=true`: renderiza con `data-cms-attribute`, `data-cms-attribute-key`, `data-cms-attribute-type`

**EditableItem** — envuelve un ítem dentro de un array o smart collection:
- Props: `enabled`, `itemType`, `itemIndex`, `itemKey`, `itemLabel`, `as`, `class`, `href`
- Cuando `enabled=true`: renderiza con `data-cms-item="true"`, `data-cms-item-type`, `data-cms-item-index`, `data-cms-item-key`

#### Scenario: Section editable renderiza markers
- **WHEN** `EditableSection` recibe `enabled=true`, `sectionId="42"`, `sectionType="hero_split"`
- **THEN** el DOM contiene `data-cms-editable="true"` y `data-cms-section-id="42"` en el tag raíz

#### Scenario: Sin enabled no hay markers
- **WHEN** `EditableSection` recibe `enabled=false`
- **THEN** el DOM no contiene ningún atributo `data-cms-*`

### Requirement: Estilos CSS de preview

`@proxima/storefront-builder-sdk` SHALL exportar `preview.css` con estilos para los estados visuales en modo preview: highlighted, selected, hover, tree-hover, pulse en secciones y atributos.

#### Scenario: Importación de estilos
- **WHEN** un layout importa `@proxima/storefront-builder-sdk/preview.css`
- **THEN** los estilos se aplican a elementos con `data-cms-highlighted`, `data-cms-selected`, `data-cms-tree-hover`

### Requirement: Utilidades TypeScript

`@proxima/storefront-builder-sdk` SHALL exportar las funciones utilitarias:
- `isCmsPreview(url: URL): boolean`
- `getPreviewRobots(robots: string, preview: boolean): string`
- `resolveCmsCompositionPageId(composition: unknown): number | string | null`
- `normalizeCmsSection(section: unknown): CmsSectionRecord`
- `toSectionMeta(pageId, section): CmsSectionMeta | undefined`
- `getAttributeMeta(section, name): CmsAttributeMeta | undefined`

Y los tipos: `CmsSectionRecord`, `CmsAttributeMeta`, `CmsSectionMeta`.

#### Scenario: Utilidades exportadas
- **WHEN** un proyecto Astro importa `@proxima/storefront-builder-sdk`
- **THEN** puede usar todas las funciones utilitarias y tipos sin instalar dependencias adicionales
