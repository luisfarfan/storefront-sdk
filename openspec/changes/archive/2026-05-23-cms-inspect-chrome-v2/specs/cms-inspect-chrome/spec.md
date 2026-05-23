## ADDED Requirements

### Requirement: Metadata de inspección en wrappers editables

Los componentes `EditableSection`, `EditableAttribute` y `EditableItem` SHALL, cuando `enabled=true`, emitir atributos `data-cms-*` suficientes para renderizar chrome de inspección sin conocer el `section_type`:

| Componente | Atributos mínimos nuevos o reforzados |
|------------|----------------------------------------|
| EditableSection | `data-cms-inspect-title` (nombre de sección), `data-cms-inspect-kind="section"` |
| EditableAttribute | `data-cms-inspect-title`, `data-cms-editor-kind`, `data-cms-attribute-ui` (si aplica), `data-cms-localizable` (si aplica) |
| EditableItem | `data-cms-inspect-title`, `data-cms-item-parent-key` (desde prop o ancestro), `data-cms-inspect-kind="item"` |

Los títulos SHALL preferir `label` del API, luego `name` / key.

#### Scenario: Atributo con label del API

- **WHEN** `EditableAttribute` recibe `label="Productos del Hero"` y `type="smart_collection_id"`
- **THEN** el DOM incluye `data-cms-inspect-title` con texto legible y `data-cms-editor-kind="collection"`

### Requirement: Estilos unificados en preview.css

`preview.css` SHALL definir chrome para modo `body[data-cms-preview='true'][data-cms-preview-mode='edit']`:

- Hover en sección, atributo e ítem con outline y badge (`::after` o `::before`) usando `attr(data-cms-inspect-title)`.
- Estados: selected, highlighted, tree-hover, draft-applied, attribute-pulse.
- Modo `body[data-cms-inspect-labels='all']` muestra badges sin hover.
- `prefers-reduced-motion: reduce` desactiva animación pulse.

#### Scenario: Hover muestra nombre del campo

- **WHEN** el usuario pasa el mouse sobre un `[data-cms-attribute]` en modo edit
- **THEN** aparece un badge con el contenido de `data-cms-inspect-title`

### Requirement: Utilidades buildEditableAttributeProps

El paquete SHALL exportar `buildEditableAttributeProps(meta, name, overrides?)` que devuelve props para `EditableAttribute` (`attributeKey`, `type`, `label`, `ui`, `localizable`, `editorKind`).

#### Scenario: Meta del API

- **WHEN** `getAttributeMeta(section, 'heading')` tiene `label` y `type`
- **THEN** `buildEditableAttributeProps` devuelve `label` y `attributeKey` alineados al meta

### Requirement: select-item incluye parentAttributeKey

`CmsPreviewBridge` SHALL incluir `parentAttributeKey` en el payload de `cms:select-item` cuando el ítem está dentro de un `[data-cms-attribute]`.

#### Scenario: Clic en ítem de lista

- **WHEN** el usuario hace clic en un `[data-cms-item]` dentro de un atributo `messages`
- **THEN** el payload incluye `parentAttributeKey: "messages"`
