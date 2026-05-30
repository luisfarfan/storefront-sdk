import { describe, it, expect } from "vitest";
import {
  createFixtureBundle,
  createStorefrontDataSource,
  validateFixtureBundle,
  FixtureGuestOrderError,
} from "../src/fixtures-commerce.js";

const CATALOG = [
  {
    id: 1,
    slug: "rtx-4090-fe",
    name: { es: "ASUS ROG Strix RTX 4090" },
    brand: { name: { es: "ASUS" }, slug: "asus" },
    category: { name: { es: "GPUs" }, slug: "gpus" },
    price: 4999,
    default_variant_id: 1001,
    image_url: { medium: "https://cdn.test/rtx.jpg" },
    variants: [{ id: 1001, price: 4999, stock: 5 }],
  },
  {
    id: 2,
    slug: "rog-strix-g16",
    name: { es: "ROG Strix G16" },
    brand: { name: { es: "ASUS" }, slug: "asus" },
    category: { name: { es: "Laptops" }, slug: "laptops" },
    price: 6299,
    default_variant_id: 1002,
    image_url: { medium: "https://cdn.test/laptop.jpg" },
    variants: [{ id: 1002, price: 6299, stock: 3 }],
  },
];

const NAV_TREE = {
  nodes: [
    {
      id: 1,
      slug: "pc-components",
      name: "Componentes PC",
      href: "/categoria/pc-components",
      image_url: null,
      product_count: 1,
      children: [],
    },
  ],
  total: 1,
};

const CART = {
  id: "cart-1",
  session_id: "sess-1",
  customer_id: null,
  items: [
    {
      id: 1,
      product_variant_id: 1001,
      quantity: 1,
      metadata: { name: "RTX 4090", unit_price: 4999 },
    },
  ],
  totals: { subtotal: 4999, formatted_subtotal: "S/ 4,999.00", currency: "PEN" },
};

function makeBundle(overrides: Partial<Parameters<typeof createFixtureBundle>[0]> = {}) {
  return createFixtureBundle({
    catalog: CATALOG,
    categoryNavTree: NAV_TREE,
    cart: CART,
    categoryProductMap: { "pc-components": ["rtx-4090-fe"] },
    ...overrides,
  });
}

describe("createFixtureBundle", () => {
  it("returns cart fixture", () => {
    const bundle = makeBundle();
    expect(bundle.getCart().items).toHaveLength(1);
  });

  it("returns category listing from map", () => {
    const bundle = makeBundle();
    const listing = bundle.getCategoryProducts("pc-components");
    expect(listing.category.name).toBe("Componentes PC");
    expect(listing.items).toHaveLength(1);
    expect(listing.items[0]?.slug).toBe("rtx-4090-fe");
  });

  it("falls back to full catalog for unknown category", () => {
    const bundle = makeBundle();
    const listing = bundle.getCategoryProducts("unknown");
    expect(listing.items).toHaveLength(2);
  });

  it("returns empty cart when cart fixture omitted", () => {
    const bundle = makeBundle({ cart: undefined });
    expect(bundle.getCart().items).toHaveLength(0);
  });

  it("filters PLP by brand", () => {
    const bundle = makeBundle();
    const listing = bundle.getProductListing({ filters: { brand: "asus" } });
    expect(listing.items).toHaveLength(2);
  });

  it("searches products by query", () => {
    const bundle = makeBundle();
    const result = bundle.searchProducts({ q: "strix g16" });
    expect(result.total).toBe(1);
    expect(result.hits[0]?.slug).toBe("rog-strix-g16");
  });

  it("mutates cart in memory", () => {
    const bundle = makeBundle({ cart: undefined });
    const cart = bundle.addToCart("sess-a", 1002, 1);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.product_variant_id).toBe(1002);
    const updated = bundle.updateCartItem("sess-a", 1002, 2);
    expect(updated.items[0]?.quantity).toBe(2);
    const removed = bundle.removeCartItem("sess-a", 1002);
    expect(removed.items).toHaveLength(0);
  });

  it("processes guest checkout and clears cart", () => {
    const bundle = makeBundle();
    const result = bundle.processGuestCheckout("sess-1", {
      session_id: "sess-1",
      customer_name: "Test",
      customer_phone: "999",
      customer_email: "test@test.com",
    });
    expect(result.orderId).toMatch(/^fixture-order-/);
    expect(bundle.getCart("sess-1").items).toHaveLength(0);
  });

  it("throws on empty cart checkout", () => {
    const bundle = makeBundle({ cart: undefined });
    expect(() =>
      bundle.processGuestCheckout("empty", {
        session_id: "empty",
        customer_name: "Test",
        customer_phone: "999",
        customer_email: "test@test.com",
      }),
    ).toThrow(FixtureGuestOrderError);
  });
});

describe("validateFixtureBundle", () => {
  it("passes valid bundle", () => {
    const errors = validateFixtureBundle({
      catalog: CATALOG,
      categoryNavTree: NAV_TREE,
      cart: CART,
      categoryProductMap: { "pc-components": ["rtx-4090-fe"] },
    });
    expect(errors).toEqual([]);
  });

  it("detects missing composition slug", () => {
    const errors = validateFixtureBundle(
      { catalog: CATALOG, categoryNavTree: NAV_TREE },
      { compositionProductSlugs: ["missing-slug"] },
    );
    expect(errors.some((e) => e.includes("missing-slug"))).toBe(true);
  });

  it("detects invalid cart variant", () => {
    const errors = validateFixtureBundle({
      catalog: CATALOG,
      categoryNavTree: NAV_TREE,
      cart: {
        ...CART,
        items: [{ id: 1, product_variant_id: 9999, quantity: 1 }],
      },
    });
    expect(errors.some((e) => e.includes("9999"))).toBe(true);
  });

  it("detects invalid categoryProductMap slug", () => {
    const errors = validateFixtureBundle({
      catalog: CATALOG,
      categoryNavTree: NAV_TREE,
      categoryProductMap: { gpus: ["nonexistent"] },
    });
    expect(errors.some((e) => e.includes("nonexistent"))).toBe(true);
  });
});

describe("createStorefrontDataSource", () => {
  it("uses fixtures in fixtures mode", async () => {
    const bundle = makeBundle();
    const ds = createStorefrontDataSource({
      mode: "fixtures",
      fixtures: bundle,
      apiConfig: { baseUrl: "http://api.test" },
      website: { business_id: "biz", locale: "es", currency: "PEN" },
    });
    const cart = await ds.getCart({ sessionId: "sess-1" });
    expect(cart.items).toHaveLength(1);
    const tree = await ds.getCategoryNavTree();
    expect(tree.nodes[0]?.slug).toBe("pc-components");
    const plp = await ds.getProductListing();
    expect(plp.items.length).toBeGreaterThan(0);
    const search = await ds.searchProducts({ q: "4090" });
    expect(search.total).toBeGreaterThan(0);
  });
});
