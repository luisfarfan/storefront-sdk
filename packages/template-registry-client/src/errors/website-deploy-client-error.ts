import type { WebsiteDeployBreakingChange } from '../types/website-deploy.js';

export class WebsiteDeployClientError extends Error {
  readonly status?: number;
  readonly responseText?: string;
  readonly breakingChanges?: WebsiteDeployBreakingChange[];

  constructor(
    message: string,
    options: {
      status?: number;
      responseText?: string;
      breakingChanges?: WebsiteDeployBreakingChange[];
    } = {},
  ) {
    super(message);
    this.name = 'WebsiteDeployClientError';
    this.status = options.status;
    this.responseText = options.responseText;
    this.breakingChanges = options.breakingChanges;
  }
}
