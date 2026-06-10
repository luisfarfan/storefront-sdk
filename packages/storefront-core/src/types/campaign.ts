export interface CampaignScheduleMeta {
  /** ISO UTC datetime — null if not configured. */
  countdown_target_at: string | null;
  /** Which field the target was sourced from. */
  countdown_target_source:
    | "section_attribute"
    | "config.display.countdown_target_at"
    | "active_until"
    | null;
}

/**
 * Full shape of a resolved Smart Collection as returned in section
 * `attributes_meta` or `resolved_data` by the composition API.
 */
export interface ResolvedSmartCollectionInfo {
  collection: {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
    active_from: string | null;
    active_until: string | null;
    config: { display?: { countdown_target_at?: string | null } };
    website_id?: string | null;
    cache_ttl?: number;
    contract_type?: string | null;
  };
  schedule: {
    data_window: { from: string | null; until: string | null };
    countdown_target_at: string | null;
    countdown_target_source: string | null;
  };
  meta: {
    inactive: boolean;
    inactive_reason: "disabled" | "before_start" | "after_end" | null;
  };
}

/** Remaining-time snapshot for a countdown. */
export interface CampaignCountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when targetAt is null or already in the past. */
  expired: boolean;
  targetAt: string | null;
}
