/**
 * Admin + storefront CMS routes used by the template registry clients.
 */
export const RegistryEndpoints = {
  admin: {
    websiteTemplates: () => '/api/v1/admin/cms/website-templates',
    websiteTemplate: (templateId: string) => `/api/v1/admin/cms/website-templates/${templateId}`,
    websiteTemplateByKey: (templateKey: string) =>
      `/api/v1/admin/cms/website-templates/${encodeURIComponent(templateKey)}`,
    templateStructure: (templateKey: string) =>
      `/api/v1/admin/cms/website-templates/${encodeURIComponent(templateKey)}/structure`,
    templatePublish: (templateKey: string) =>
      `/api/v1/admin/cms/website-templates/${encodeURIComponent(templateKey)}/publish`,
    websitesDeploy: (force?: boolean) =>
      `/api/v1/admin/cms/websites/deploy${force ? '?force=true' : ''}`,
  },
  storefront: {
    websiteTemplates: () => '/api/v1/storefront/cms/website-templates',
    websiteTemplatePreview: (templateId: string, query: string) =>
      `/api/v1/storefront/cms/website-templates/${templateId}/preview?${query}`,
  },
} as const;
