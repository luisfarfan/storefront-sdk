import type {
  CampaignCountdownState,
  CampaignScheduleMeta,
  ResolvedSmartCollectionInfo,
} from '../types/campaign.js';

/**
 * Returns a single countdown snapshot for the given ISO UTC target.
 * Safe to call server-side — no timers.
 */
export function getCampaignCountdown(targetAt: string | null): CampaignCountdownState {
  if (!targetAt) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, targetAt };
  }
  const diffMs = new Date(targetAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, targetAt };
  }
  const s = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
    targetAt,
  };
}

/**
 * Creates a client-side ticker that calls `onTick` every second until expiry.
 * Fires immediately on creation. Returns a cleanup function that cancels the
 * interval — call it in cleanup / on component unmount.
 *
 * ```ts
 * const stop = createCampaignTicker(targetAt, (state) => {
 *   renderCountdown(state);
 *   if (state.expired) stop();
 * });
 * ```
 */
export function createCampaignTicker(
  targetAt: string,
  onTick: (state: CampaignCountdownState) => void,
): () => void {
  const tick = () => {
    const state = getCampaignCountdown(targetAt);
    onTick(state);
    if (state.expired) clearInterval(handle);
  };
  tick();
  const handle = setInterval(tick, 1000);
  return () => clearInterval(handle);
}

/**
 * Extracts the countdown target from `attributes_meta` for a `datetime`-type
 * attribute. Returns null if the attribute has no schedule metadata.
 *
 * ```ts
 * // In section frontmatter:
 * const targetAt = resolveCampaignTarget(props.attributesMeta, "campaign_end_date");
 * ```
 */
export function resolveCampaignTarget(
  attributesMeta: Record<string, any> | null | undefined,
  attrName: string,
): string | null {
  const schedule = attributesMeta?.[attrName]?.schedule as CampaignScheduleMeta | null | undefined;
  return schedule?.countdown_target_at ?? null;
}

/**
 * Extracts the countdown target from a resolved Smart Collection's `schedule`
 * block. Returns null if the SC is missing or has no countdown target.
 *
 * ```ts
 * // sc comes from section.attributes.products_sc or similar:
 * const targetAt = resolveSmartCollectionTarget(sc);
 * ```
 */
export function resolveSmartCollectionTarget(
  sc: ResolvedSmartCollectionInfo | Record<string, any> | null | undefined,
): string | null {
  return (sc as ResolvedSmartCollectionInfo)?.schedule?.countdown_target_at ?? null;
}