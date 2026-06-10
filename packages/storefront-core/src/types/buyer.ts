/** Well-known error detail strings returned by the API. Use these for comparison
 *  instead of hardcoding strings in your storefront.
 *
 * @example
 * try { await resetPassword(...) } catch (e: any) {
 *   if (e.data?.detail === BUYER_AUTH_ERRORS.RESET_TOKEN_INVALID) { ... }
 * }
 */
export const BUYER_AUTH_ERRORS = {
  RESET_TOKEN_INVALID:    "RESET_TOKEN_INVALID",
  VERIFY_TOKEN_INVALID:   "VERIFY_TOKEN_INVALID",
  EMAIL_ALREADY_VERIFIED: "EMAIL_ALREADY_VERIFIED",
  EMAIL_TAKEN:            "Email already registered in this store",
  MISSING_REQUIRED_FIELDS: "MISSING_REQUIRED_FIELDS",
  /** Turnstile enabled but captcha_token missing or invalid (HTTP 422). */
  CAPTCHA_REQUIRED:       "CAPTCHA_REQUIRED",
} as const;

/** True when the API rejected auth because Turnstile verification failed or was omitted. */
export function isCaptchaRequiredError(err: unknown): boolean {
  const e = err as { status?: number; data?: { detail?: string } };
  return e?.status === 422 && e?.data?.detail === BUYER_AUTH_ERRORS.CAPTCHA_REQUIRED;
}

// ---------------------------------------------------------------------------
// Buyer Auth types
// ---------------------------------------------------------------------------

/** Token pair returned by /store/auth/register, /store/auth/login, /store/auth/refresh */
export interface BuyerSession {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
}

/** Full customer profile from GET /store/me */
export interface BuyerProfile {
  id: number;
  email: string;
  business_id: string;
  full_name: string | null;
  phone: string | null;
  doc_type: number | null;          // 1=DNI 2=CE 3=Pasaporte 6=RUC
  doc_number: string | null;
  birth_date: string | null;        // "YYYY-MM-DD"
  newsletter_subscribed: boolean;
  avatar_url: string | null;
  metadata: Record<string, any>;    // custom fields configured per merchant
  registration_source: string;      // "organic" | "google_ads" | ...
  last_login_at: string | null;     // ISO datetime
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Registration Form types
// ---------------------------------------------------------------------------

/** A single resolved field in the storefront registration form. */
export interface RegistrationFormField {
  name: string;
  label: string;
  /** "text" | "password" | "phone" | "date" | "select" | "boolean" | "image" | "address" | "custom" */
  type: string;
  /** "text_input" | "phone_input" | "date_picker" | "select" | "checkbox" | "toggle"
   *  | "image_upload" | "ubigeo_selector" | "google_maps_picker" | "manual" */
  widget: string;
  widget_config: Record<string, any>;
  required: boolean;
  order: number;
  options: string[] | null;
}

/** A single step in the form (always at least one). */
export interface RegistrationFormStep {
  id: string;
  label: string;
  order: number;
  skippable: boolean;
  fields: RegistrationFormField[];
}

/** Full resolved form schema from GET /store/auth/registration-form.
 *  `email` and `password` are always present in steps[0].fields — no need to add them. */
export interface RegistrationForm {
  mode: "single_step" | "multi_step";
  steps: RegistrationFormStep[];
}

// ---------------------------------------------------------------------------
// Registration params & errors
// ---------------------------------------------------------------------------

/** Address submitted during customer registration. */
export interface AddressInRegistration {
  line1: string;
  line2?: string | null;
  reference?: string | null;
  /** 6-digit Peruvian ubigeo code, e.g. "150101" */
  ubigeo_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** "google_maps" | "ubigeo_centroid" | "manual" */
  geocoding_source?: string | null;
}

/** All accepted fields for POST /store/auth/register.
 *  Which fields are required depends on the merchant's registration form configuration.
 *  Use fetchRegistrationForm() to know which fields to show and which are required. */
export interface BuyerRegisterParams {
  email: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
  /** 1=DNI 2=CE 3=Pasaporte 6=RUC */
  docType?: number | null;
  docNumber?: string | null;
  /** ISO date "YYYY-MM-DD" */
  birthDate?: string | null;
  newsletterSubscribed?: boolean;
  /** Default "organic". */
  registrationSource?: string;
  /** Custom fields configured by the merchant — keyed by field name. */
  metadata?: Record<string, any>;
  address?: AddressInRegistration | null;
  /** Cloudflare Turnstile token from the widget — required when API has TURNSTILE_ENABLED=true */
  captchaToken?: string | null;
}

/** A single field that was missing in the registration request. */
export interface MissingField {
  field: string;
  msg: string; // always "FIELD_REQUIRED"
}

/**
 * Thrown when the API returns 422 MISSING_REQUIRED_FIELDS.
 * Use `error.missingFields` to mark exactly which fields are invalid in the UI.
 *
 * @example
 * try {
 *   await registerBuyer(config, website, params);
 * } catch (e) {
 *   if (e instanceof MissingFieldsError) {
 *     for (const { field } of e.missingFields) markFieldError(field);
 *   }
 * }
 */
export class MissingFieldsError extends Error {
  status = 422 as const;
  missingFields: MissingField[];
  constructor(missingFields: MissingField[]) {
    super("MISSING_REQUIRED_FIELDS");
    this.name = "MissingFieldsError";
    this.missingFields = missingFields;
  }
}

// ---------------------------------------------------------------------------
// Profile update params
// ---------------------------------------------------------------------------

/** Fields the customer can update via PATCH /store/me/profile. All optional. */
export interface BuyerProfileUpdateParams {
  fullName?: string | null;
  phone?: string | null;
  /** 1=DNI 2=CE 3=Pasaporte 6=RUC */
  docType?: number | null;
  docNumber?: string | null;
  /** ISO date "YYYY-MM-DD" */
  birthDate?: string | null;
  newsletterSubscribed?: boolean;
  avatarUrl?: string | null;
  /** If provided, changes the customer's password. */
  password?: string;
}