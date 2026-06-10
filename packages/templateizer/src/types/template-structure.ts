export type SmartCollectionPlaceholderDef = {
  name: string;
  type: string;
  contract_type?: string;
  config?: Record<string, unknown>;
  cache_ttl?: number;
  instantiate_config?: Record<string, unknown>;
};

export type TemplateStructure = {
  shell_sections: unknown[];
  smart_collection_placeholders: Record<string, SmartCollectionPlaceholderDef>;
  pages: unknown[];
  layouts: unknown[];
};

export type ManifestPublishResult = {
  manifest_s3_key?: string;
  manifest_s3_version_id?: string | null;
  sections_validated?: number;
};

export type ManifestPublishValidationError = {
  location: string;
  section_type: string;
  attribute: string;
  code: string;
  message: string;
};
