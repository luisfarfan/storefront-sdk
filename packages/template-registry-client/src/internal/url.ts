export function normalizeApiUrl(value?: string): string {
  return (value ?? '').replace(/\/$/u, '');
}

export function redactToken(value: string, token: string): string {
  return token ? value.split(token).join('[REDACTED]') : value;
}
