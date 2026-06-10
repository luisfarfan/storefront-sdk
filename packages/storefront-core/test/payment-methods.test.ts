import { describe, expect, it } from 'vitest';
import {
  paymentMethodsFromAttributes,
  paymentMethodsFromShell,
} from '../src/cms/payment-methods.js';

describe('paymentMethodsFromAttributes', () => {
  it('returns empty array when payment_methods is missing', () => {
    expect(paymentMethodsFromAttributes({})).toEqual([]);
    expect(paymentMethodsFromAttributes(undefined)).toEqual([]);
  });

  it('normalizes embedded storefront payment method payloads', () => {
    expect(
      paymentMethodsFromAttributes({
        payment_methods: [
          {
            code: 'yape',
            name_es: 'Yape',
            description_es: 'Wallet',
            category: 'wallet',
            kind: 'offline',
            icon_url: null,
          },
          { code: '' },
        ],
      }),
    ).toEqual([
      {
        code: 'yape',
        name_es: 'Yape',
        description_es: 'Wallet',
        category: 'wallet',
        kind: 'offline',
        icon_url: null,
      },
    ]);
  });
});

describe('paymentMethodsFromShell', () => {
  it('reads payment methods from the footer shell slot', () => {
    expect(
      paymentMethodsFromShell({
        footer: {
          section_id: 1,
          section_type: 'footer',
          section_name: 'Footer',
          attributes: {
            payment_methods: [
              {
                code: 'visa',
                name_es: 'Visa',
                category: 'card_brand',
                kind: 'hybrid',
              },
            ],
          },
        },
      }),
    ).toEqual([
      {
        code: 'visa',
        name_es: 'Visa',
        description_es: null,
        category: 'card_brand',
        kind: 'hybrid',
        icon_url: null,
      },
    ]);
  });
});
