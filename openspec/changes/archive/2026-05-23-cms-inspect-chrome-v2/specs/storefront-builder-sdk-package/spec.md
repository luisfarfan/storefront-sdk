## MODIFIED Requirements

### Requirement: Componentes Astro editables

**EditableAttribute** — envuelve un campo editable:

- Props: `enabled`, `name`, `attributeKey`, `type`, `label`, `ui`, `localizable`, `as`, `class`, `href`
- Cuando `enabled=true`: renderiza con `data-cms-attribute`, `data-cms-attribute-key`, `data-cms-attribute-type`, `data-cms-inspect-title`, `data-cms-editor-kind`, y opcionalmente `data-cms-attribute-ui`, `data-cms-localizable`

**EditableItem** — envuelve un ítem dentro de un array o smart collection:

- Props: `enabled`, `itemType`, `itemIndex`, `itemKey`, `itemLabel`, `parentAttributeKey`, `as`, `class`, `href`
- Cuando `enabled=true`: renderiza con `data-cms-item="true"`, `data-cms-item-type`, `data-cms-item-index`, `data-cms-item-key`, `data-cms-inspect-title`, `data-cms-item-parent-key`

**EditableSection** — cuando `enabled=true`: también `data-cms-inspect-title`, `data-cms-inspect-kind="section"`

#### Scenario: Attribute con inspect title

- **WHEN** `EditableAttribute` está enabled con label
- **THEN** el DOM contiene `data-cms-inspect-title` no vacío

### Requirement: Estilos CSS de preview

`preview.css` SHALL incluir badges en hover para sección, atributo e ítem; SHALL documentarse como única fuente de verdad para chrome CMS (consumidores no duplican las mismas reglas).

#### Scenario: Importación única

- **WHEN** un layout importa solo `@proxima-io/storefront-builder-sdk/preview.css`
- **THEN** hover en atributos muestra badge con `data-cms-inspect-title`

### Requirement: Utilidades TypeScript

Además de las funciones existentes, el paquete SHALL exportar:

- `resolveEditorKind(type: string, ui?: string | null): string`
- `buildEditableAttributeProps(meta, name, overrides?): object`
- `buildEditableItemInspectTitle(itemLabel, itemType, itemIndex, parentKey?): string`
