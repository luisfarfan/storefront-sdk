export * from './types.js';

import type { ResolverKind } from './types.js';

const COMMERCE_RESOLVERS = new Set<ResolverKind>([
  'cart',
  'checkout',
  'buyer_login',
  'buyer_account',
]);

export function isCommerceResolver(kind: ResolverKind): boolean {
  return COMMERCE_RESOLVERS.has(kind);
}
