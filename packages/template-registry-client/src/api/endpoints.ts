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
    websitesExport: (params: {
      websiteDomain: string;
      scope?: string;
      fixtureDomain?: string;
      catalogMaxProducts?: number;
      catalogIncludeClosure?: boolean;
    }) => {
      const search = new URLSearchParams();
      search.set('website_domain', params.websiteDomain);
      if (params.scope) search.set('scope', params.scope);
      if (params.fixtureDomain) search.set('fixture_domain', params.fixtureDomain);
      if (params.catalogMaxProducts != null) {
        search.set('catalog_max_products', String(params.catalogMaxProducts));
      }
      if (params.catalogIncludeClosure != null) {
        search.set('catalog_include_closure', String(params.catalogIncludeClosure));
      }
      return `/api/v1/admin/cms/websites/export?${search.toString()}`;
    },
  },
  storefront: {
    websiteTemplates: () => '/api/v1/storefront/cms/website-templates',
    websiteTemplatePreview: (templateId: string, query: string) =>
      `/api/v1/storefront/cms/website-templates/${templateId}/preview?${query}`,
  },
} as const;
