export interface WebsiteDeployOptions {
  /** Base URL of the Proxima API. Default: process.env.PROXIMA_API_URL */
  apiUrl?: string;
  /** Service key for the website's business. Default: process.env.PROXIMA_SERVICE_KEY */
  serviceKey?: string;
  /** Optional fetch override (for testing). */
  fetchImpl?: typeof fetch;
}

export interface WebsiteDeployResult {
  ok: boolean;
  website: { id: number; domain: string };
  section_types: { created: string[]; updated: string[]; unchanged: string[] };
  pages: {
    created: string[];
    scaffolded: Record<string, string[]>;
    skipped: Record<string, string>;
  };
  warnings: string[];
}

export interface WebsiteDeployBreakingChange {
  section_type: string;
  attribute: string;
  change: string;
  from: string;
  to: string;
}

export type WebsiteDeployManifest = {
  section_types: unknown[];
  pages: unknown[];
  shell_sections?: unknown[];
};
