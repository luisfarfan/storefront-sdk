/**
 * Admin API route catalog (service-key authenticated).
 */
export const AdminEndpoints = {
  cms: {
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
} as const;
