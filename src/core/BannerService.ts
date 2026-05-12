/**
 * BannerService - HTTP client for banner API calls in React Native
 */
import { Banner } from './types';

export const DEFAULT_API_URL = 'https://trukit-dev.truconsent.io';

export interface FetchBannerConfig {
  bannerId: string;
  apiKey?: string;
  organizationId: string;
  /**
   * Web SDK parity:
   * If provided, use `/api/v1/internal/consent/{assetId}/{bannerId}?userId=...`
   */
  apiUrl?: string;
  assetId?: string;
  userId?: string;
  token?: string;
  authToken?: string;
}

export interface SubmitConsentConfig {
  collectionPointId: string;
  userId: string;
  purposes: any[];
  action: string;
  apiKey?: string;
  organizationId: string;
  requestId?: string;
  /**
   * Web SDK parity:
   * POST `/api/v1/internal/consent/{collectionPointId}`
   */
  apiUrl?: string;
  assetId?: string;
  token?: string;
  authToken?: string;
  metadata?: Record<string, any>;
  consentLanguage?: string;
  collectionPointVersion?: string;
  consentTimestamp?: number;
  source?: string;
}

export interface SubmitSuppressionConfig {
  apiUrl: string;
  apiKey?: string;
  organizationId: string;
  token?: string;
  authToken?: string;
  userId: string;
  declinedPurposeIds: string[];
}

function withNoTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}


function appendUserId(url: string, userId?: string) {
  if (!userId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}userId=${encodeURIComponent(userId)}`;
}

function buildHeaders(apiKey?: string, effectiveToken?: string, organizationId?: string) {
  return {
    'Content-Type': 'application/json',
    ...(organizationId ? { 'X-Org-Id': organizationId } : {}),
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
  };
}

/**
 * Fetch banner configuration from API.
 * Correct URL: GET {apiUrl}/api/v1/internal/consent/{assetId}/{bannerId}?userId={userId}
 * If no assetId: GET {apiUrl}/api/v1/internal/consent/{bannerId}?userId={userId}
 */
export async function fetchBanner(config: FetchBannerConfig): Promise<Banner> {
  const {
    bannerId,
    apiKey,
    organizationId,
    apiUrl,
    assetId,
    userId,
    token,
    authToken,
  } = config;

  if (!bannerId) {
    throw new Error('Missing bannerId');
  }
  if (!organizationId) {
    throw new Error('Missing organizationId - Organization ID is required for authentication');
  }

  const effectiveToken = token ?? authToken;
  if (!apiKey && !effectiveToken) {
    throw new Error('Missing apiKey/token - authentication is required');
  }

  if (!apiUrl) {
    throw new Error('Missing apiUrl - TruAPI root URL is required');
  }

  const resolvedApiUrl = apiUrl;
  const base = `${withNoTrailingSlash(resolvedApiUrl)}/api/v1/internal/consent`;
  const encodedBannerId = encodeURIComponent(bannerId);
  const encodedAssetId = assetId ? encodeURIComponent(assetId) : '';

  const headers = buildHeaders(apiKey, effectiveToken, organizationId);

  // Build candidate URLs: with assetId first, then without
  const candidateUrls: string[] = [];
  if (assetId) {
    candidateUrls.push(appendUserId(`${base}/${encodedAssetId}/${encodedBannerId}`, userId));
  }
  candidateUrls.push(appendUserId(`${base}/${encodedBannerId}`, userId));

  let response: Response | null = null;
  let lastStatus = 0;
  for (const url of candidateUrls) {
    console.log('Fetching banner from:', url);
    response = await fetch(url, { headers });
    lastStatus = response.status;
    console.log('Banner API response status:', response.status, 'for', url);

    if (response.ok || response.status === 401 || response.status === 403 || response.status === 429) {
      break;
    }
    if (response.status !== 404) {
      break;
    }
  }

  if (!response) {
    throw new Error('Failed to fetch banner: no response from server');
  }

  if (response.status === 401) {
    throw new Error('Unauthorized - Invalid or missing API key');
  }
  if (response.status === 403) {
    throw new Error('Forbidden - This domain is not authorized');
  }
  if (response.status === 429) {
    throw new Error('Rate limit exceeded');
  }
  if (response.status === 404) {
    throw new Error(
      `Banner not found - Banner ID "${bannerId}" does not exist or is not accessible (last status ${lastStatus})`
    );
  }
  if (!response.ok) {
    let errorMessage = `Failed to load banner (${response.status})`;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const errorText = await response.text();
        const match = errorText.match(/<p>(.*?)<\/p>/i);
        if (match && match[1]) {
          errorMessage = match[1].trim();
        } else if (errorText && errorText.length < 200) {
          errorMessage = errorText;
        }
      }
    } catch (e) {
      console.error('Error parsing error response:', e);
    }
    console.error('Banner API error:', errorMessage);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('Banner data received:', JSON.stringify(data, null, 2));
  return data;
}

/**
 * Submit consent to the backend.
 * Correct URL: POST {apiUrl}/api/v1/internal/consent/{collectionPointId}
 */
export async function submitConsent(config: SubmitConsentConfig): Promise<any> {
  const {
    collectionPointId,
    userId,
    purposes,
    action,
    apiKey,
    organizationId,
    requestId,
    apiUrl,
    assetId,
    token,
    authToken,
    metadata,
    consentLanguage = 'en',
    collectionPointVersion = 'v1.0',
    consentTimestamp,
    source = 'react-native',
  } = config;

  if (!collectionPointId) {
    throw new Error('Missing collectionPointId');
  }
  if (!organizationId) {
    throw new Error('Missing organizationId');
  }

  const effectiveToken = token ?? authToken;
  if (!apiKey && !effectiveToken) {
    throw new Error('Missing apiKey/token - authentication is required');
  }

  if (!apiUrl) {
    throw new Error('Missing apiUrl - TruAPI root URL is required');
  }

  const resolvedApiUrl = apiUrl;
  const url = `${withNoTrailingSlash(resolvedApiUrl)}/api/v1/internal/consent/${encodeURIComponent(collectionPointId)}`;

  const payload: Record<string, any> = {
    userId,
    requestId,
    assetId,
    consentLanguage,
    collectionPointId,
    collectionPointVersion,
    consentTimestamp: consentTimestamp ?? Math.floor(Date.now() / 1000),
    source,
    purposes,
    action,
  };
  if (metadata) payload.metadata = metadata;

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(apiKey, effectiveToken, organizationId),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `Failed to submit consent (${response.status})`;
    try {
      const errData = await response.json();
      errorMessage = errData.message || errData.error || errorMessage;
    } catch (_) {}
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Submit suppression record for declined purposes (fire-and-forget).
 * POST {apiUrl}/api/v1/internal/consent/suppression
 */
export async function submitSuppression(config: SubmitSuppressionConfig): Promise<void> {
  const { apiUrl, apiKey, organizationId, token, authToken, userId, declinedPurposeIds } = config;

  if (!declinedPurposeIds || declinedPurposeIds.length === 0) return;

  const effectiveToken = token ?? authToken;
  const resolvedApiUrl = apiUrl;
  const url = `${withNoTrailingSlash(resolvedApiUrl)}/api/v1/internal/consent/suppression`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: buildHeaders(apiKey, effectiveToken, organizationId),
      body: JSON.stringify({ userId, declinedPurposeIds }),
    });
  } catch (e) {
    console.warn('Suppression API call failed (fire-and-forget):', e);
  }
}
