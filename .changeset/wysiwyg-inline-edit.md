---
"@proxima-io/storefront-builder-sdk": minor
---

WYSIWYG inline edit + premium live-preview UX.

**New feature: dblclick-to-edit on text/rich_text/number attributes**

Merchants can now double-click any `data-cms-attribute` of type `text`,
`rich_text` or `number` directly in the iframe to edit it in place
(Webflow-style). Every keystroke streams to the builder via
`cms:inline-edit`; Enter / blur commits, Escape reverts cleanly
(builder undoes the orphan draft via `cms:inline-edit-cancel`).

**New outbound messages (iframe → builder):**

- `cms:inline-edit-start` — `{ attributeKey, attributeType }`
- `cms:inline-edit` — `{ attributeKey, attributeType, value }`
- `cms:inline-edit-commit` — `{ attributeKey, attributeType, value }`
- `cms:inline-edit-cancel` — `{ attributeKey, attributeType }`

**Anti-fight guard:** `applyDraftToNode` now early-returns when an
element carries `data-cms-inline-editing="true"`, so the 280ms
debounced `cms:replace-draft-state` from the builder never overwrites
mid-word typing.

**Discoverability (preview.css):**

Inline-editable attribute types now show an I-beam cursor on hover and
a "✏ Doble clic para editar" hint appears after 600ms hover. Without
this signal the feature was invisible to merchants.

**Visual feedback for the inline-edit state:**

Active inline-edit element gets a 2px blue outline, soft glow, and a
floating "Editando — Enter para confirmar · Esc para cancelar"
helper tag.

**Pairs with proxima-builder ≥ 1.0.0** which implements the receiving
side (`store.setAttributeDraft` / `store.resetAttributeDraft` routing,
status chip, time-travel undo).
