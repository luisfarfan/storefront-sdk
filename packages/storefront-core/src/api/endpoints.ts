/**
 * Storefront API route catalog.
 * Public anonymous surface: `/api/v1/storefront/*`
 * Authenticated customer surface: `/api/v1/store/*`
 */
export const StorefrontEndpoints = {
  cms: {
    websites: () => '/api/v1/storefront/cms/websites',
    resolveWebsite: () => '/api/v1/storefront/cms/websites/resolve',
    composition: (websiteId: string) =>
      `/api/v1/storefront/cms/websites/${websiteId}/pages/composition`,
  },

  business: {
    profile: () => '/api/v1/storefront/business/profile',
  },

  campaigns: {
    list: () => '/api/v1/storefront/campaigns',
    bySlug: (slug: string) => `/api/v1/storefront/campaigns/${encodeURIComponent(slug)}`,
  },

  catalog: {
    search: () => '/api/v1/storefront/search',
    products: () => '/api/v1/storefront/products',
    categories: () => '/api/v1/storefront/categories',
    categoryTree: () => '/api/v1/storefront/categories/tree',
    categoryProducts: (slug: string) =>
      `/api/v1/storefront/categories/${encodeURIComponent(slug)}/products`,
    brands: () => '/api/v1/storefront/brands',
    brandProducts: (slug: string) =>
      `/api/v1/storefront/brands/${encodeURIComponent(slug)}/products`,
    /** @deprecated raw catalog — use storefront products */
    legacyProducts: () => '/api/v1/products',
    ubigeos: () => '/api/v1/catalog/locations/ubigeos',
  },

  commerce: {
    paymentInstructions: () => '/api/v1/storefront/payment-instructions',
    validateCoupon: () => '/api/v1/storefront/coupons/validate',
  },

  auth: {
    registrationForm: () => '/api/v1/store/auth/registration-form',
    register: () => '/api/v1/store/auth/register',
    login: () => '/api/v1/store/auth/login',
    logout: () => '/api/v1/store/auth/logout',
    refresh: () => '/api/v1/store/auth/refresh',
    forgotPassword: () => '/api/v1/store/auth/forgot-password',
    resetPassword: () => '/api/v1/store/auth/reset-password',
    verifyEmail: () => '/api/v1/store/auth/verify-email',
    resendVerification: () => '/api/v1/store/auth/resend-verification',
  },

  buyer: {
    me: () => '/api/v1/store/me',
    profile: () => '/api/v1/store/me/profile',
    orders: () => '/api/v1/store/me/orders',
    addresses: () => '/api/v1/store/me/addresses/',
    address: (addressId: number) => `/api/v1/store/me/addresses/${addressId}`,
    defaultAddress: (addressId: number) =>
      `/api/v1/store/me/addresses/${addressId}/default`,
    wishlist: () => '/api/v1/store/me/wishlist',
    wishlistItem: (productId: string) => `/api/v1/store/me/wishlist/${productId}`,
  },

  cart: {
    root: () => '/api/v1/storefront/cart',
    items: () => '/api/v1/storefront/cart/items',
    item: (itemId: number) => `/api/v1/storefront/cart/items/${itemId}`,
    merge: () => '/api/v1/storefront/cart/merge',
  },

  checkout: () => '/api/v1/storefront/checkout',

  orders: {
    byId: (orderId: string) => `/api/v1/storefront/orders/${orderId}`,
  },

  analytics: {
    events: () => '/api/v1/store/events',
  },
} as const;
