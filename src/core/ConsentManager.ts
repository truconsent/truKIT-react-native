/**
 * ConsentManager - Consent state management for React Native
 */
import { Purpose, ConsentAction } from './types';

// ---------------------------------------------------------------------------
// Normalized Purpose types
// ---------------------------------------------------------------------------

export interface NormalizedPurpose extends Purpose {
  isLegitimate: boolean;
  isMandatory: boolean;
  legalBasis: 'notice' | 'consent';
  withdrawable: boolean;
  isDynamic: boolean;
  consented: 'accepted' | 'declined' | 'shown';
}

// ---------------------------------------------------------------------------
// Purpose Normalization (ported from purposeAdapter.js)
// ---------------------------------------------------------------------------

export function normalizePurpose(
  raw: Purpose,
  defaultSelection: 'all' | 'mandatory_only' | 'none' = 'mandatory_only'
): NormalizedPurpose {
  const isLegitimate =
    raw.is_legitimate === true ||
    Boolean(raw.isLegitimate) ||
    String(raw.purpose_type ?? '').toLowerCase().includes('legitimate');

  const isMandatory = raw.is_mandatory === true || Boolean(raw.isMandatory);
  const legalBasis: 'notice' | 'consent' = isLegitimate ? 'notice' : 'consent';
  const withdrawable = !isLegitimate && raw.frequency === 'recurring';
  const isDynamic = raw.is_dynamic === true || Boolean(raw.isDynamic);

  let consented: 'accepted' | 'declined' | 'shown';
  if (isLegitimate || isMandatory) {
    consented = 'accepted';
  } else if (defaultSelection === 'all') {
    consented = 'accepted';
  } else {
    // 'none' or 'mandatory_only' → optional purposes default to declined
    consented = 'declined';
  }

  return {
    ...raw,
    isLegitimate,
    isMandatory,
    legalBasis,
    withdrawable,
    isDynamic,
    consented,
    version: raw.version ?? 'v1.0',
  };
}

export function normalizePurposes(
  purposes: Purpose[],
  defaultSelection: 'all' | 'mandatory_only' | 'none' = 'mandatory_only'
): NormalizedPurpose[] {
  const normalized = purposes.map((p) => normalizePurpose(p, defaultSelection));

  // Sort: Legitimate(1) > Mandatory(2) > Recurring(3) > Optional(4)
  return normalized.sort((a, b) => {
    const rank = (p: NormalizedPurpose) => {
      if (p.isLegitimate) return 1;
      if (p.isMandatory) return 2;
      if (p.withdrawable) return 3;
      return 4;
    };
    return rank(a) - rank(b);
  });
}

export function filterDynamicPurposes(
  purposes: NormalizedPurpose[],
  previousConsent?: any[]
): NormalizedPurpose[] {
  if (!previousConsent || previousConsent.length === 0) {
    return purposes.filter((p) => !p.isDynamic);
  }
  const previousIds = new Set(previousConsent.map((p: any) => p.purposeId || p.id));
  return purposes.filter((p) => !p.isDynamic || !previousIds.has(p.id));
}

// ---------------------------------------------------------------------------
// Banner State (ported from bannerState.js)
// ---------------------------------------------------------------------------

export enum BannerCase {
  TABBED = 1,
  NORMAL = 2,
  NOTICE_ONLY = 3,
}

export interface UIState {
  noticeOnly: boolean;
  consentOnly: boolean;
  isHCase: boolean;
  hasRequiredConsent: boolean;
  bannerCase: BannerCase;
  noticePurposes: NormalizedPurpose[];
  consentPurposes: NormalizedPurpose[];
  mandatoryConsentPurposes: NormalizedPurpose[];
  optionalConsentPurposes: NormalizedPurpose[];
}

export function detectBannerCase(purposes: NormalizedPurpose[]): BannerCase {
  const hasNotice = purposes.some((p) => p.isLegitimate);
  const hasConsent = purposes.some((p) => !p.isLegitimate);

  if (hasNotice && hasConsent) return BannerCase.TABBED;
  if (hasNotice && !hasConsent) return BannerCase.NOTICE_ONLY;
  return BannerCase.NORMAL;
}

export function deriveUIState(purposes: NormalizedPurpose[]): UIState {
  const noticePurposes = purposes.filter((p) => p.isLegitimate);
  const consentPurposes = purposes.filter((p) => !p.isLegitimate);
  const mandatoryConsentPurposes = consentPurposes.filter((p) => p.isMandatory);
  const optionalConsentPurposes = consentPurposes.filter((p) => !p.isMandatory);

  const bannerCase = detectBannerCase(purposes);
  const noticeOnly = bannerCase === BannerCase.NOTICE_ONLY;
  const consentOnly = bannerCase === BannerCase.NORMAL;
  const hasRequiredConsent = mandatoryConsentPurposes.length > 0;
  const isHCase = hasRequiredConsent && consentPurposes.some((p) => !p.isMandatory);

  return {
    noticeOnly,
    consentOnly,
    isHCase,
    hasRequiredConsent,
    bannerCase,
    noticePurposes,
    consentPurposes,
    mandatoryConsentPurposes,
    optionalConsentPurposes,
  };
}

// ---------------------------------------------------------------------------
// Legacy helpers (kept for backwards compatibility)
// ---------------------------------------------------------------------------

/**
 * Update a single purpose's consent status in the purposes array
 */
export function updatePurposeStatus(
  purposes: Purpose[],
  purposeId: string,
  newStatus: 'accepted' | 'declined'
): Purpose[] {
  return purposes.map((p) =>
    p.id === purposeId ? { ...p, consented: newStatus } : p
  );
}

/**
 * Automatically accept all mandatory purposes while keeping user's selections for optional ones
 */
export function acceptMandatoryPurposes(purposes: Purpose[]): Purpose[] {
  return purposes.map((p) => ({
    ...p,
    consented: p.is_mandatory ? 'accepted' : p.consented,
  }));
}

/**
 * Determine consent action based on purpose states
 */
export function determineConsentAction(
  purposes: Purpose[],
  previousPurposes: Purpose[] | null = null
): ConsentAction {
  if (!purposes || purposes.length === 0) {
    return 'declined';
  }

  // Check for revocation (previously accepted, now declined)
  if (previousPurposes) {
    const hasRevocation = purposes.some((p) => {
      const previous = previousPurposes.find((prev) => prev.id === p.id);
      return previous && previous.consented === 'accepted' && p.consented === 'declined';
    });
    if (hasRevocation) {
      return 'revoked';
    }
  }

  const allAccepted = purposes.every(
    (p) => p.consented === 'accepted' || (p.consented as any) === true
  );
  if (allAccepted) {
    return 'approved';
  }

  const allDeclined = purposes.every(
    (p) => p.consented === 'declined' || (p.consented as any) === false
  );
  if (allDeclined) {
    return 'declined';
  }

  return 'partial_consent';
}

/**
 * Get all accepted purposes
 */
export function getAcceptedPurposes(purposes: Purpose[]): Purpose[] {
  return purposes.filter((p) => p.consented === 'accepted' || (p.consented as any) === true);
}

/**
 * Get all declined purposes
 */
export function getDeclinedPurposes(purposes: Purpose[]): Purpose[] {
  return purposes.filter((p) => p.consented === 'declined' || (p.consented as any) === false);
}

/**
 * Check if any optional purposes are accepted
 */
export function hasOptionalAccepted(purposes: Purpose[]): boolean {
  return purposes
    .filter((p) => !p.is_mandatory)
    .some((p) => p.consented === 'accepted' || (p.consented as any) === true);
}

/**
 * Check if there are any mandatory purposes
 */
export function hasMandatoryPurposes(purposes: Purpose[]): boolean {
  return purposes.some((p) => p.is_mandatory);
}
