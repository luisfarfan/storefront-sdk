import { describe, expect, it } from "vitest";
import {
  buildEditableAttributeProps,
  buildEditableItemInspectTitle,
  resolveEditorKind,
  resolveEditorKindLabel,
} from "../src/inspect-meta";

describe("inspect-meta", () => {
  it("resolveEditorKind maps CMS types generically", () => {
    expect(resolveEditorKind("smart_collection_id")).toBe("collection");
    expect(resolveEditorKind("array", "ticker_items")).toBe("list");
    expect(resolveEditorKind("text")).toBe("text");
    expect(resolveEditorKind("image")).toBe("media");
  });

  it("buildEditableAttributeProps prefers API meta", () => {
    const props = buildEditableAttributeProps(
      {
        label: "Productos del Hero",
        type: "smart_collection_id",
        attribute_key: "hero_products",
      },
      "hero_products",
    );
    expect(props.inspectTitle).toBe("Productos del Hero");
    expect(props.editorKind).toBe("collection");
    expect(props.editorKindLabel).toBe(resolveEditorKindLabel("collection"));
    expect(props.attributeKey).toBe("hero_products");
  });

  it("buildEditableItemInspectTitle includes parent key", () => {
    expect(
      buildEditableItemInspectTitle({
        itemLabel: "Gaming Week",
        itemType: "message",
        itemIndex: 0,
        parentAttributeKey: "messages",
      }),
    ).toBe("Gaming Week #1 · messages");
  });
});
