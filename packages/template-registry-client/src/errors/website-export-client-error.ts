export class WebsiteExportClientError extends Error {
  readonly status?: number;
  readonly responseText?: string;

  constructor(
    message: string,
    options: { status?: number; responseText?: string } = {},
  ) {
    super(message);
    this.name = 'WebsiteExportClientError';
    this.status = options.status;
    this.responseText = options.responseText;
  }
}
