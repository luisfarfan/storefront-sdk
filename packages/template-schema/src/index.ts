import { z } from "zod";

export const sensitiveKeys = new Set(["token", "secret", "password", "api_key", "private_key"]);
const sensitiveSuffixes = ["_token", "_secret", "_password", "_api_key", "_private_key"];

export const attributeTypes = [
  "text",
  "rich_text",
  "image",
  "boolean",
  "number",
  "link",
  "object",
  "array",
  "smart_collection_id",
] as const;

export const smartCollectionTypes = [
  "product_list",
  "category_list",
  "brand_list",
  "banner",
  "manual",
  "search_preview",
] as const;

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);

const jsonObject = z.record(jsonValue);

export const previewImageSchema = z.object({
  url: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  kind: z.string().optional(),
  order: z.number().int().default(0),
});

export const attributeSchemaItemSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(attributeTypes),
  config: jsonObject.default({}),
  order: z.number().int().default(0),
  is_required: z.boolean().default(false),
  localizable: z.boolean().default(true),
  default_value: jsonValue.optional(),
});

export const sectionTypeSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  category: z.string().optional(),
  renderer: z.string().min(1),
  structure_locked: z.boolean().default(true),
  attribute_schema: z.array(attributeSchemaItemSchema).min(1),
});

export const templateSectionSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  order: z.number().int().default(0),
  values: jsonObject.default({}),
});

export const templatePageSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  resolver_kind: z.string().optional(),
  entity_type: z.string().optional(),
  params: z.array(z.string()).default([]),
  order: z.number().int().default(0),
  sections: z.array(templateSectionSchema).default([]),
  seo: jsonObject.optional(),
});

export const smartCollectionPlaceholderSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(smartCollectionTypes),
  config: jsonObject.default({}),
  preview_data: jsonValue.optional(),
  instantiate_config: jsonObject.default({}),
});

export const repositoryConfigSchema = jsonObject.default({});

export const deploymentConfigSchema = jsonObject.default({});

export const templateManifestSchema = z
  .object({
    template_key: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional(),
    category: z.string().min(1),
    industry: z.string().optional(),
    tags: z.array(z.string()).default([]),
    editable_scope: z.literal("content_only").default("content_only"),
    repository_config: repositoryConfigSchema,
    deployment_config: deploymentConfigSchema,
    renderer_contract: jsonObject.default({}),
    capabilities: z.array(z.string()).default([]),
    theme_tokens: jsonObject.default({}),
    animation_config: jsonObject.default({}),
    preview_image: z.string().optional(),
    preview_images: z.array(previewImageSchema).default([]),
    section_types: z.array(sectionTypeSchema).min(1),
    pages: z.array(templatePageSchema).min(1),
    smart_collection_placeholders: z.array(smartCollectionPlaceholderSchema).default([]),
    preview_data: jsonObject.default({}),
  })
  .superRefine((manifest, ctx) => {
    rejectSensitiveKeys(manifest.repository_config, ctx, ["repository_config"]);
    rejectSensitiveKeys(manifest.deployment_config, ctx, ["deployment_config"]);

    const sectionTypeKeys = new Set(manifest.section_types.map((sectionType) => sectionType.key));
    for (const [pageIndex, page] of manifest.pages.entries()) {
      for (const [sectionIndex, section] of page.sections.entries()) {
        if (!sectionTypeKeys.has(section.type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Section type '${section.type}' is not declared in section_types`,
            path: ["pages", pageIndex, "sections", sectionIndex, "type"],
          });
        }
      }
    }

    const placeholderKeys = new Set(manifest.smart_collection_placeholders.map((placeholder) => placeholder.key));
    for (const reference of findPlaceholderReferences(manifest.pages)) {
      if (!placeholderKeys.has(reference.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Smart Collection placeholder '${reference.key}' is not declared`,
          path: reference.path,
        });
      }
    }
  });

export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export function parseTemplateManifest(value: unknown): TemplateManifest {
  return templateManifestSchema.parse(value);
}

export function validateTemplateManifest(value: unknown) {
  return templateManifestSchema.safeParse(value);
}

export function findPlaceholderReferences(value: unknown, path: Array<string | number> = []): Array<{ key: string; path: Array<string | number> }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findPlaceholderReferences(item, [...path, index]));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record._smart_collection_placeholder === "string") {
      return [{ key: record._smart_collection_placeholder, path: [...path, "_smart_collection_placeholder"] }];
    }
    return Object.entries(record).flatMap(([key, child]) => findPlaceholderReferences(child, [...path, key]));
  }
  return [];
}

function rejectSensitiveKeys(value: unknown, ctx: z.RefinementCtx, path: Array<string | number>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveKeys(item, ctx, [...path, index]));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeKey(key);
    if (sensitiveKeys.has(normalized) || sensitiveSuffixes.some((suffix) => normalized.endsWith(suffix))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${[...path, key].join(".")} contains sensitive metadata and cannot be persisted`,
        path: [...path, key],
      });
    }
    rejectSensitiveKeys(child, ctx, [...path, key]);
  }
}

function normalizeKey(key: string): string {
  return key
    .replace(/-/g, "_")
    .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
