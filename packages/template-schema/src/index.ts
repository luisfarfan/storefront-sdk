import { z } from "zod";

export const sensitiveKeys = new Set(["token", "secret", "password", "api_key", "private_key"]);
const sensitiveSuffixes = ["_token", "_secret", "_password", "_api_key", "_private_key"];

export const attributeTypes = [
  "text",
  "rich_text",
  "image",
  "boolean",
  "number",
  "datetime",
  "url",
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

// ---------------------------------------------------------------------------
// WebsiteDeployManifest — simpler schema for deploying to a specific website.
// Used by `templateizer website-deploy`. Does NOT require marketplace fields.
// ---------------------------------------------------------------------------

export const websiteDeployAttributeSchema = z.object({
  name:        z.string().min(1),
  label:       z.string().optional(),
  type:        z.enum(attributeTypes),
  config:      jsonObject.default({}),
  order:       z.number().int().default(0),
  is_required: z.boolean().default(false),
  localizable: z.boolean().default(false),
});

export const websiteDeploySectionTypeSchema = z.object({
  key:              z.string().min(1),
  label:            z.string().min(1),
  category:         z.string().optional(),
  attribute_schema: z.array(websiteDeployAttributeSchema).default([]),
});

export const websiteDeployScaffoldSectionSchema = z.object({
  section_type:   z.string().min(1),
  order:          z.number().int().default(0),
  // Canonical field — the section's initial content. Applied by both
  // `proxima deploy` (Section.values) and `proxima template:publish`
  // (TemplateStructure → instantiate). Renamed from `default_values` —
  // the legacy name is still accepted for backwards compat with 214store
  // and nocturna manifests.
  values:         z.record(jsonValue).optional(),
  default_values: z.record(jsonValue).optional(),
});

export const websiteDeployPageSchema = z.object({
  resolver_kind:     z.string().min(1),
  path:              z.string().optional(),
  paths:             z.record(z.string()).optional(),
  label:             z.string().optional(),
  scaffold_sections: z.array(websiteDeployScaffoldSectionSchema).default([]),
});

export const websiteDeployShellSectionSchema = z.object({
  key:          z.string().min(1),
  section_type: z.string().min(1).optional(),
  label:        z.string().optional(),
  order:        z.number().int().default(0),
  // Canonical field — see scaffold section's `values` doc. Coexists with the
  // legacy top-level `shell_default_values[slot]` map for backwards compat.
  values:       z.record(jsonValue).optional(),
});

export const websiteDeploySmartCollectionPlaceholderSchema = z.object({
  name:             z.string().min(1),
  type:             z.enum(smartCollectionTypes),
  contract_type:    z.string().optional(),
  config:           jsonObject.default({}),
  cache_ttl:        z.number().int().default(300),
  instantiate_config: jsonObject.optional(),
});

export const websiteDeployManifestSchema = z
  .object({
    schema_version:              z.literal("1.0").default("1.0"),
    section_types:               z.array(websiteDeploySectionTypeSchema).min(1),
    pages:                       z.array(websiteDeployPageSchema).default([]),
    shell_sections:              z.array(websiteDeployShellSectionSchema).default([]),
    shell_default_values:        z.record(jsonObject).optional(),
    smart_collection_placeholders: z.record(websiteDeploySmartCollectionPlaceholderSchema).optional(),
    // Marketplace metadata — synced on every template-deploy
    name:              z.string().optional(),
    short_description: z.string().optional(),
    description:       z.string().optional(),
    demo_url:          z.string().url().optional(),
    features:          z.array(z.string()).default([]),
    pricing_tier:      z.enum(["free", "premium", "enterprise"]).default("free"),
    color_palette:     z.array(z.string()).default([]),
    tags:              z.array(z.string()).default([]),
    category:          z.string().optional(),
    industry:          z.string().optional(),
    preview_image:     z.string().optional(),
  })
  .superRefine((manifest, ctx) => {
    const keys = new Set(manifest.section_types.map((st) => st.key));

    manifest.shell_sections.forEach((shell, si) => {
      const sectionType = shell.section_type ?? shell.key;
      if (!keys.has(sectionType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `section_type '${sectionType}' is not declared in section_types`,
          path: ["shell_sections", si, "section_type"],
        });
      }
    });

    const shellKeys = new Set<string>();
    manifest.shell_sections.forEach((shell, si) => {
      if (shellKeys.has(shell.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate shell key '${shell.key}'`,
          path: ["shell_sections", si, "key"],
        });
      }
      shellKeys.add(shell.key);
    });

    // All section_type keys in scaffold_sections must exist in section_types
    manifest.pages.forEach((page, pi) => {
      page.scaffold_sections.forEach((scaffold, si) => {
        if (!keys.has(scaffold.section_type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `section_type '${scaffold.section_type}' is not declared in section_types`,
            path: ["pages", pi, "scaffold_sections", si, "section_type"],
          });
        }
      });
    });

    // Static pages (content_page) must have a path
    manifest.pages.forEach((page, pi) => {
      if (page.resolver_kind === "content_page" && !page.path && !page.paths) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pages with resolver_kind 'content_page' require a 'path' or 'paths' field",
          path: ["pages", pi, "path"],
        });
      }
    });

    const seenPaths = new Map<string, number>();
    const ENGINE_RESOLVER_KINDS = new Set([
      "product_list",
      "product_detail",
      "category_detail",
      "brand_detail",
      "search",
      "buyer_search",
    ]);

    manifest.pages.forEach((page, pi) => {
      const localized = page.paths ?? (page.path ? { _: page.path } : {});
      for (const [locale, pagePath] of Object.entries(localized)) {
        const key = `${locale}:${pagePath}`;
        const previous = seenPaths.get(key);
        if (previous !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate path '${pagePath}' for locale '${locale}' (also on pages[${previous}])`,
            path: ["pages", pi, "paths", locale],
          });
        } else {
          seenPaths.set(key, pi);
        }
      }

      if (ENGINE_RESOLVER_KINDS.has(page.resolver_kind) && page.paths) {
        const placeholders = Object.values(page.paths).map((path) =>
          [...(path.match(/\{([^{}]+)\}/g) ?? [])].sort().join(","),
        );
        const unique = new Set(placeholders);
        if (unique.size > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `engine page '${page.resolver_kind}' paths must use the same placeholders in every locale`,
            path: ["pages", pi, "paths"],
          });
        }
      }
    });
  });

export type WebsiteDeployManifest = z.infer<typeof websiteDeployManifestSchema>;

export function parseWebsiteDeployManifest(value: unknown): WebsiteDeployManifest {
  return websiteDeployManifestSchema.parse(value);
}

export function validateWebsiteDeployManifest(value: unknown) {
  return websiteDeployManifestSchema.safeParse(value);
}
