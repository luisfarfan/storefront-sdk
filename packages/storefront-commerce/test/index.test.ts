import { describe, it, expect } from 'vitest';
import { isCommerceResolver } from '../src/index.js';
import type { ResolverKind } from '../src/index.js';

describe('isCommerceResolver', () => {
  const commerceKinds: ResolverKind[] = ['cart', 'checkout', 'buyer_login', 'buyer_account'];
  const contentKinds: ResolverKind[] = ['content_page', 'product_list', 'product_detail'];

  for (const kind of commerceKinds) {
    it(`returns true for "${kind}"`, () => {
      expect(isCommerceResolver(kind)).toBe(true);
    });
  }

  for (const kind of contentKinds) {
    it(`returns false for "${kind}"`, () => {
      expect(isCommerceResolver(kind)).toBe(false);
    });
  }
});
