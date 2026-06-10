export class RegistryClientError extends Error {
  readonly status?: number;
  readonly responseText?: string;

  constructor(message: string, options: { status?: number; responseText?: string } = {}) {
    super(message);
    this.name = 'RegistryClientError';
    this.status = options.status;
    this.responseText = options.responseText;
  }
}
