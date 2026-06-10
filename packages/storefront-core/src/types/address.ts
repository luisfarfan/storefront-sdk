export interface UbigeoResult {
  code: string;
  department: string;
  province: string;
  district: string;
  full_name: string;
}

export interface CustomerAddress {
  id: number;
  customer_id: number;
  business_id: string;
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  ubigeo_code?: string | null;
  ubigeo?: UbigeoResult | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoding_source?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInput {
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  ubigeo_code?: string | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoding_source?: string | null;
  is_default?: boolean;
}