## ADDED Requirements

### Requirement: Validación de template manifest con Zod

`@proxima/template-schema` SHALL exportar `validateTemplateManifest(value: unknown): SafeParseResult` que valida un objeto contra el schema completo de `proxima.template.json` usando Zod. SHALL también exportar `parseTemplateManifest(value: unknown): TemplateManifest` que lanza si el input es inválido.

El schema SHALL validar:
- Campos requeridos: `template_key`, `name`, `slug`, `category`, `section_types` (min 1), `pages` (min 1).
- Cada `section_type` tiene `key`, `label`, `renderer`, y `attribute_schema` (min 1).
- Cada `attribute_schema` item tiene `name`, `type` (enum de tipos permitidos), `config`, `order`, `is_required`, `localizable`.
- Cada sección en `pages` referencia un `section_type.key` declarado — error si no existe.
- Cada referencia a `_smart_collection_placeholder` apunta a un placeholder declarado en `smart_collection_placeholders`.
- `repository_config` y `deployment_config` no pueden contener claves sensibles (`token`, `secret`, `password`, `api_key`, etc.).

#### Scenario: Manifest válido
- **WHEN** se llama con un JSON completo y correcto
- **THEN** `validateTemplateManifest` retorna `{ success: true, data: TemplateManifest }`

#### Scenario: Sección referencia type inexistente
- **WHEN** una sección en `pages` tiene `type: "unknown_section"` no declarado en `section_types`
- **THEN** `validateTemplateManifest` retorna `{ success: false, error }` con un issue en la ruta `pages[n].sections[m].type`

#### Scenario: Clave sensible en config
- **WHEN** `deployment_config` contiene `{ "api_token": "abc123" }`
- **THEN** la validación falla con un issue indicando que la clave contiene metadata sensible

### Requirement: Tipos TypeScript del manifest

`@proxima/template-schema` SHALL exportar los tipos inferidos de Zod:
- `TemplateManifest` — tipo completo del manifest
- `SectionTypeSchema` — tipo de un section type
- `AttributeSchemaItem` — tipo de un ítem de atributo
- `TemplatePageSchema` — tipo de una página del template
- `SmartCollectionPlaceholder` — tipo de un placeholder de smart collection

SHALL exportar las constantes de tipos permitidos:
- `attributeTypes` — array de los tipos de atributo válidos: `text`, `rich_text`, `image`, `boolean`, `number`, `link`, `object`, `array`, `smart_collection_id`
- `smartCollectionTypes` — array de los tipos de smart collection válidos

#### Scenario: Tipos usables sin runtime Zod
- **WHEN** un proyecto importa solo los tipos de `@proxima/template-schema`
- **THEN** puede usar `TemplateManifest` como tipo TypeScript sin ejecutar validación Zod

### Requirement: Helper para referencias a placeholders

`@proxima/template-schema` SHALL exportar `findPlaceholderReferences(value: unknown): Array<{ key: string, path: Array<string | number> }>` que recorre recursivamente un objeto y retorna todas las referencias a `_smart_collection_placeholder`.

#### Scenario: Encuentra referencias anidadas
- **WHEN** el valor contiene `{ sections: [{ values: { _smart_collection_placeholder: "featured" } }] }`
- **THEN** retorna `[{ key: "featured", path: ["sections", 0, "values", "_smart_collection_placeholder"] }]`
