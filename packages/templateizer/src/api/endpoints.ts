import { RegistryEndpoints } from '@proxima-io/template-registry-client';

/**
 * Admin API route catalog (service-key authenticated).
 * Re-exported from @proxima-io/template-registry-client.
 */
export const AdminEndpoints = {
  cms: RegistryEndpoints.admin,
} as const;
