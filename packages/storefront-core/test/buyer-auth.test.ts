/**
 * Tests for new/updated buyer auth SDK methods.
 * Covers tasks 3.2–3.3, 4.4–4.7, 5.4–5.5, 6.2–6.3, 7.2–7.5, 8.2–8.4, 9.2–9.9
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchRegistrationForm,
  registerBuyer,
  MissingFieldsError,
  BUYER_AUTH_ERRORS,
  isCaptchaRequiredError,
  updateBuyerProfile,
  refreshBuyerToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  fetchWishlist,
  addToWishlist,
  removeFromWishlist,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CONFIG = { baseUrl: 'http://api.test' };
const WEBSITE = { business_id: 'biz-123' };

function mockFetch(response: {
  ok: boolean;
  status?: number;
  body?: unknown;
}) {
  const status = response.status ?? (response.ok ? 200 : 400);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: response.ok,
    status,
    json: async () => response.body ?? {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 3. fetchRegistrationForm
// ---------------------------------------------------------------------------

describe('fetchRegistrationForm', () => {
  it('returns RegistrationForm with steps and mode (task 3.2)', async () => {
    const form = {
      mode: 'single_step',
      steps: [
        {
          id: 'step_1',
          label: 'Datos personales',
          order: 1,
          skippable: false,
          fields: [
            { name: 'email', label: 'Email', type: 'text', widget: 'text_input', widget_config: {}, required: true, order: 1, options: null },
            { name: 'password', label: 'Contraseña', type: 'password', widget: 'text_input', widget_config: {}, required: true, order: 2, options: null },
          ],
        },
      ],
    };
    mockFetch({ ok: true, body: form });

    const result = await fetchRegistrationForm(CONFIG, WEBSITE);
    expect(result.mode).toBe('single_step');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].fields).toHaveLength(2);
    expect(result.steps[0].fields[0].name).toBe('email');
  });

  it('throws error if the API responds with error (task 3.3)', async () => {
    mockFetch({ ok: false, status: 503, body: { detail: 'Service unavailable' } });
    await expect(fetchRegistrationForm(CONFIG, WEBSITE)).rejects.toMatchObject({ status: 503 });
  });
});

// ---------------------------------------------------------------------------
// 4. registerBuyer
// ---------------------------------------------------------------------------

describe('registerBuyer', () => {
  const SESSION = { access_token: 'tok-abc', refresh_token: 'ref-xyz', token_type: 'bearer' };

  it('accepts only email and password — backward compat (task 4.4)', async () => {
    mockFetch({ ok: true, body: SESSION });
    const result = await registerBuyer(CONFIG, WEBSITE, { email: 'a@b.com', password: 'pass123' });
    expect(result.access_token).toBe('tok-abc');

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.email).toBe('a@b.com');
    expect(body.password).toBe('pass123');
    // No extra fields sent
    expect(Object.keys(body)).toEqual(['email', 'password']);
  });

  it('accepts all BuyerRegisterParams fields and maps camelCase → snake_case (task 4.5)', async () => {
    mockFetch({ ok: true, body: SESSION });
    await registerBuyer(CONFIG, WEBSITE, {
      email: 'a@b.com',
      password: 'pass123',
      fullName: 'Ana López',
      phone: '+51999999999',
      docType: 1,
      docNumber: '12345678',
      birthDate: '1990-05-15',
      newsletterSubscribed: true,
      registrationSource: 'google_ads',
      metadata: { promo_code: 'PROMO10' },
      address: { line1: 'Av. Lima 123', ubigeo_code: '150101' },
    });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.full_name).toBe('Ana López');
    expect(body.phone).toBe('+51999999999');
    expect(body.doc_type).toBe(1);
    expect(body.doc_number).toBe('12345678');
    expect(body.birth_date).toBe('1990-05-15');
    expect(body.newsletter_subscribed).toBe(true);
    expect(body.registration_source).toBe('google_ads');
    expect(body.metadata).toEqual({ promo_code: 'PROMO10' });
    expect(body.address).toEqual({ line1: 'Av. Lima 123', ubigeo_code: '150101' });
  });

  it('throws MissingFieldsError when API returns MISSING_REQUIRED_FIELDS (task 4.6)', async () => {
    const detail = `MISSING_REQUIRED_FIELDS: [{'field': 'phone', 'msg': 'FIELD_REQUIRED'}, {'field': 'doc_number', 'msg': 'FIELD_REQUIRED'}]`;
    mockFetch({ ok: false, status: 422, body: { detail } });

    let caught: unknown;
    try {
      await registerBuyer(CONFIG, WEBSITE, { email: 'a@b.com', password: 'pass' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(MissingFieldsError);
    const err = caught as MissingFieldsError;
    expect(err.missingFields).toHaveLength(2);
    expect(err.missingFields[0]).toEqual({ field: 'phone', msg: 'FIELD_REQUIRED' });
    expect(err.missingFields[1]).toEqual({ field: 'doc_number', msg: 'FIELD_REQUIRED' });
    expect(err.status).toBe(422);
  });

  it('throws error with status 409 when email is already taken (task 4.7)', async () => {
    mockFetch({ ok: false, status: 409, body: { detail: BUYER_AUTH_ERRORS.EMAIL_TAKEN } });
    await expect(
      registerBuyer(CONFIG, WEBSITE, { email: 'taken@b.com', password: 'pass' })
    ).rejects.toMatchObject({ status: 409 });
  });
});

// ---------------------------------------------------------------------------
// 5. updateBuyerProfile
// ---------------------------------------------------------------------------

describe('updateBuyerProfile', () => {
  const PROFILE = {
    id: 1, email: 'a@b.com', business_id: 'biz-123',
    full_name: 'Ana López', phone: null, doc_type: null, doc_number: null,
    birth_date: null, newsletter_subscribed: false, avatar_url: null,
    metadata: {}, registration_source: 'organic', last_login_at: null,
    is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
  };

  it('returns the updated profile (task 5.4)', async () => {
    const updated = { ...PROFILE, full_name: 'Ana García', newsletter_subscribed: true };
    mockFetch({ ok: true, body: updated });

    const result = await updateBuyerProfile(CONFIG, WEBSITE, {
      token: 'tok-abc',
      fullName: 'Ana García',
      newsletterSubscribed: true,
    });

    expect(result.full_name).toBe('Ana García');
    expect(result.newsletter_subscribed).toBe(true);

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    // Only the fields we passed should be in the body
    expect(body.full_name).toBe('Ana García');
    expect(body.newsletter_subscribed).toBe(true);
    expect('email' in body).toBe(false); // email not updatable via this endpoint
  });

  it('throws error if token is invalid — 401 (task 5.5)', async () => {
    mockFetch({ ok: false, status: 401, body: { detail: 'Unauthorized' } });
    await expect(
      updateBuyerProfile(CONFIG, WEBSITE, { token: 'expired', fullName: 'X' })
    ).rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// 6. refreshBuyerToken
// ---------------------------------------------------------------------------

describe('refreshBuyerToken', () => {
  it('returns a new BuyerSession (task 6.2)', async () => {
    const newSession = { access_token: 'new-tok', refresh_token: 'new-ref', token_type: 'bearer' };
    mockFetch({ ok: true, body: newSession });

    const result = await refreshBuyerToken(CONFIG, WEBSITE, { refreshToken: 'old-ref' });
    expect(result.access_token).toBe('new-tok');
    expect(result.refresh_token).toBe('new-ref');

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('refresh_token=old-ref');
  });

  it('throws 401 if refresh token is expired (task 6.3)', async () => {
    mockFetch({ ok: false, status: 401, body: { detail: 'Token expired' } });
    await expect(
      refreshBuyerToken(CONFIG, WEBSITE, { refreshToken: 'stale-ref' })
    ).rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// 7. forgotPassword / resetPassword
// ---------------------------------------------------------------------------

describe('forgotPassword', () => {
  it('resolves without error even if email does not exist (task 7.2)', async () => {
    // API always returns 200 for security
    mockFetch({ ok: true, status: 200, body: {} });
    await expect(
      forgotPassword(CONFIG, WEBSITE, { email: 'nobody@nowhere.com' })
    ).resolves.toBeUndefined();
  });
});

describe('resetPassword', () => {
  it('throws RESET_TOKEN_INVALID on an invalid token (task 7.4)', async () => {
    mockFetch({ ok: false, status: 400, body: { detail: BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID } });
    let caught: any;
    try {
      await resetPassword(CONFIG, { token: 'bad-tok', newPassword: 'new' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.status).toBe(400);
    expect(caught.data?.detail).toBe(BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID);
  });

  it('resolves correctly with a valid token (task 7.5)', async () => {
    mockFetch({ ok: true, status: 200, body: {} });
    await expect(
      resetPassword(CONFIG, { token: 'valid-tok', newPassword: 'newPass123' })
    ).resolves.toBeUndefined();

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.token).toBe('valid-tok');
    expect(body.new_password).toBe('newPass123');
  });
});

// ---------------------------------------------------------------------------
// 8. verifyEmail / resendVerification
// ---------------------------------------------------------------------------

describe('verifyEmail', () => {
  it('throws VERIFY_TOKEN_INVALID on invalid token (task 8.2)', async () => {
    mockFetch({ ok: false, status: 400, body: { detail: BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID } });
    let caught: any;
    try {
      await verifyEmail(CONFIG, { token: 'bad-verify' });
    } catch (e) {
      caught = e;
    }
    expect(caught.status).toBe(400);
    expect(caught.data?.detail).toBe(BUYER_AUTH_ERRORS.VERIFY_TOKEN_INVALID);
  });
});

describe('resendVerification', () => {
  it('throws EMAIL_ALREADY_VERIFIED if already verified (task 8.4)', async () => {
    mockFetch({ ok: false, status: 400, body: { detail: BUYER_AUTH_ERRORS.EMAIL_ALREADY_VERIFIED } });
    let caught: any;
    try {
      await resendVerification(CONFIG, WEBSITE, { token: 'tok-abc' });
    } catch (e) {
      caught = e;
    }
    expect(caught.status).toBe(400);
    expect(caught.data?.detail).toBe(BUYER_AUTH_ERRORS.EMAIL_ALREADY_VERIFIED);
  });
});

// ---------------------------------------------------------------------------
// 9. Wishlist
// ---------------------------------------------------------------------------

describe('fetchWishlist', () => {
  it('returns empty array if no items (task 9.2)', async () => {
    mockFetch({ ok: true, body: [] });
    const result = await fetchWishlist(CONFIG, WEBSITE, { token: 'tok-abc' });
    expect(result).toEqual([]);
  });

  it('returns wishlist items (task 9.3)', async () => {
    const items = [
      { id: 1, customer_id: 42, business_id: 'biz-123', product_id: 'prod-uuid-1', variant_id: null, notes: null, added_at: '2025-01-01T00:00:00Z' },
      { id: 2, customer_id: 42, business_id: 'biz-123', product_id: 'prod-uuid-2', variant_id: 'var-a', notes: 'want this', added_at: '2025-01-02T00:00:00Z' },
    ];
    mockFetch({ ok: true, body: items });

    const result = await fetchWishlist(CONFIG, WEBSITE, { token: 'tok-abc' });
    expect(result).toHaveLength(2);
    expect(result[0].product_id).toBe('prod-uuid-1');
    expect(result[1].notes).toBe('want this');
  });
});

describe('addToWishlist', () => {
  const ITEM = { id: 1, customer_id: 42, business_id: 'biz-123', product_id: 'prod-uuid-1', variant_id: null, notes: null, added_at: '2025-01-01T00:00:00Z' };

  it('returns the created item (task 9.5)', async () => {
    mockFetch({ ok: true, status: 201, body: ITEM });
    const result = await addToWishlist(CONFIG, WEBSITE, { token: 'tok-abc', productId: 'prod-uuid-1' });
    expect(result.id).toBe(1);
    expect(result.product_id).toBe('prod-uuid-1');

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.product_id).toBe('prod-uuid-1');
  });

  it('is idempotent — returns existing item if already in wishlist (task 9.6)', async () => {
    // Backend returns 201 with existing item (no duplicate created)
    mockFetch({ ok: true, status: 201, body: ITEM });
    const r1 = await addToWishlist(CONFIG, WEBSITE, { token: 'tok-abc', productId: 'prod-uuid-1' });
    vi.unstubAllGlobals();
    mockFetch({ ok: true, status: 201, body: ITEM });
    const r2 = await addToWishlist(CONFIG, WEBSITE, { token: 'tok-abc', productId: 'prod-uuid-1' });
    expect(r1.id).toBe(r2.id);
  });
});

describe('removeFromWishlist', () => {
  it('resolves on 204 No Content (task 9.8)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => { throw new Error('No body on 204'); },
    }));

    await expect(
      removeFromWishlist(CONFIG, WEBSITE, { token: 'tok-abc', productId: 'prod-uuid-1' })
    ).resolves.toBeUndefined();

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('prod-uuid-1');
  });

  it('throws 404 if item was not in wishlist (task 9.9)', async () => {
    mockFetch({ ok: false, status: 404, body: { detail: 'Not found' } });
    await expect(
      removeFromWishlist(CONFIG, WEBSITE, { token: 'tok-abc', productId: 'ghost-id' })
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// Captcha errors (Turnstile)
// ---------------------------------------------------------------------------

describe('isCaptchaRequiredError', () => {
  it('returns true for 422 with CAPTCHA_REQUIRED detail', () => {
    expect(
      isCaptchaRequiredError({
        status: 422,
        data: { detail: BUYER_AUTH_ERRORS.CAPTCHA_REQUIRED },
      })
    ).toBe(true);
  });

  it('returns false for wrong status or detail', () => {
    expect(isCaptchaRequiredError({ status: 401, data: { detail: BUYER_AUTH_ERRORS.CAPTCHA_REQUIRED } })).toBe(false);
    expect(isCaptchaRequiredError({ status: 422, data: { detail: BUYER_AUTH_ERRORS.EMAIL_TAKEN } })).toBe(false);
    expect(isCaptchaRequiredError(null)).toBe(false);
  });
});
