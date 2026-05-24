/// <reference types="astro/client" />

interface Locals {
  buyer: import('@proxima-io/storefront-core').BuyerProfile | null;
}

interface ImportMetaEnv {
  readonly PROXIMA_API_URL: string;
  readonly PROXIMA_DOMAIN: string;
  readonly PROXIMA_SERVICE_KEY: string;
  readonly PROXIMA_BUSINESS_ID: string;
  readonly PUBLIC_PROXIMA_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __PROXIMA_BUSINESS_ID__: number;
    __PROXIMA_CURRENCY__: string;
  }
}
