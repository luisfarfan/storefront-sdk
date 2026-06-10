import type { StorefrontPaymentMethod } from '../types/business.js';
import type { ProximaWebsiteResponse } from '../types/cms.js';

function normalizePaymentMethod(raw: unknown): StorefrontPaymentMethod | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const code = String(item.code ?? '').trim();
  if (!code) return null;

  const kind = item.kind;
  const normalizedKind: StorefrontPaymentMethod['kind'] =
    kind === 'online' || kind === 'hybrid' ? kind : 'offline';

  return {
    code,
    name_es: String(item.name_es ?? code),
    description_es:
      item.description_es == null ? null : String(item.description_es),
    category: String(item.category ?? ''),
    kind: normalizedKind,
    icon_url: item.icon_url == null ? null : String(item.icon_url),
  };
}

/**
 * Normalize payment method payloads embedded in CMS shell/footer attributes.
 * The API injects enabled methods at `shell_sections.footer.attributes.payment_methods`
 * during website resolve (same tenant-wide list previously fetched separately).
 */
export function paymentMethodsFromAttributes(
  attributes: Record<string, unknown> | undefined | null,
): StorefrontPaymentMethod[] {
  const raw = attributes?.payment_methods;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizePaymentMethod)
    .filter((item): item is StorefrontPaymentMethod => item !== null);
}

/**
 * Read enabled payment methods from a resolved website's shell footer slot.
 */
export function paymentMethodsFromShell(
  shellSections: ProximaWebsiteResponse['shell_sections'] | undefined,
  footerKey = 'footer',
): StorefrontPaymentMethod[] {
  const footer = shellSections?.[footerKey];
  if (!footer?.attributes) return [];
  return paymentMethodsFromAttributes(footer.attributes);
}
