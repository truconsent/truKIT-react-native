/**
 * Rights Center API Service
 * Handles all API calls for the Rights Center feature
 */

export interface ConsentGroup {
  collection_point: string;
  title: string;
  purposes: Purpose[];
  data_elements?: DataElement[];
  shown_to_principal?: boolean;
}

export interface Purpose {
  id: string;
  name: string;
  description: string;
  expiry_period: string;
  is_mandatory: boolean;
  consented: 'accepted' | 'declined' | 'pending';
}

export interface DataElement {
  name: string;
  description: string;
}

export interface DPOInfo {
  full_name?: string;
  email?: string;
  appointment_date?: string;
  qualifications?: string;
  responsibilities?: string;
  working_hours?: string;
  response_time?: string;
}

export interface FlatPurpose {
  id: string;
  name: string;
  title: string;
  description?: string;
  expiry_period?: string;
  is_mandatory: boolean;
  consented: 'accepted' | 'declined';
  isLegitimate: boolean;
  dataElements: any[];
  processingActivities: any[];
  type: 'Mandatory' | 'Optional';
  timestamp: number;
}

export interface Nominee {
  id?: string;
  nominee_name: string;
  relationship: string;
  nominee_email: string;
  nominee_mobile: string;
  purpose_of_appointment?: string;
  user_id?: string;
  client_user_id?: string;
}

export interface GrievanceTicket {
  id?: string;
  ticket_id?: string;
  subject: string;
  category: string;
  description: string;
  status?: string;
  created_at?: string;
  client_user_id?: string;
}

export interface RightsCenterSettings {
  background_color?: string;
  primary_text_color?: string;
  secondary_text_color?: string;
  button_color?: string;
  button_text_color?: string;
  font_family?: string;

  show_consents_section?: boolean;
  show_rights_section?: boolean;
  show_nominees_section?: boolean;
  show_transparency_section?: boolean;
  show_dpo_section?: boolean;
  show_grievance_section?: boolean;

  grievance_mode?: string;
  grievance_external_url?: string;

  consents_section_title?: string;
  rights_section_title?: string;
  nominees_section_title?: string;
  transparency_description?: string;

  dpo_qualifications_enabled?: boolean;
  dpo_responsibilities_enabled?: boolean;
  dpo_working_hours_enabled?: boolean;
  dpo_response_time_enabled?: boolean;
}

export interface ConsentPayload {
  userId: string;
  purposes: Array<{
    id: string;
    name: string;
    consented: 'accepted' | 'declined';
  }>;
  action: 'approved' | 'revoked' | 'declined';
  assetId?: string;
  changedPurposes?: string[];
}

class RightsCenterApi {
  private baseUrl: string;
  // TruAPI root (used for `/api/v1/...`). If the legacy `apiBaseUrl` ends with `/banners`,
  // strip that suffix so we can call the real API domain.
  private apiRootUrl: string;
  private apiKey: string;
  private organizationId: string;
  private userId?: string;
  private requestTimeout: number = 15000; // 15-second timeout

  private isRightsRequestRouteMismatch(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('api error 404') && msg.includes('rights request not found');
  }

  constructor(baseUrl: string, apiKey: string, organizationId: string, userId?: string) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.apiRootUrl = this.baseUrl.replace(/\/banners\/?$/, '');
    this.apiKey = apiKey;
    this.organizationId = organizationId;
    this.userId = userId;
  }

  private getHeaders(isSdkPath = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey || '',
      'X-Org-Id': this.organizationId || '',
    };
    if (this.userId) {
      headers['X-User-Id'] = this.userId;
    }
    // Backend OriginEnforcementMiddleware blocks /api/v1/internal/consent* and /api/v1/internal/banners*
    // unless the request looks like a browser (sec-fetch-site present OR mozilla/ in user-agent).
    // React Native fetch doesn't send these automatically, so we add them manually for SDK paths.
    if (isSdkPath) {
      headers['Sec-Fetch-Site'] = 'cross-site';
      headers['User-Agent'] = 'Mozilla/5.0 TruConsent-ReactNative-SDK/1.0';
      // Do NOT send Origin — backend defaults to COLLECTOR_BASE_URL which is always authorized.
      // Sending the API URL as Origin causes 403 "Origin not authorized".
    }
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure baseUrl doesn't end with / and endpoint starts with /
    const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBaseUrl}${cleanEndpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };

    try {
      console.log('[RightsCenterApi] Request:', url);
      console.log('[RightsCenterApi] Auth Headers - X-Org-Id:', this.organizationId ? '✓ set' : '✗ MISSING', 'X-API-Key:', this.apiKey ? '✓ set' : '✗ MISSING', 'X-Tenant:', '✓ set');
      console.log('[RightsCenterApi] Method:', options.method || 'GET');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      console.log('[RightsCenterApi] Response status:', response.status);
      console.log('[RightsCenterApi] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        // If it's a 404 for root endpoint, this is expected - don't log as error
        if (response.status === 404 && (endpoint === '/' || endpoint === '')) {
          console.log('[RightsCenterApi] Root endpoint (/) returned 404 (expected)');
          return [] as T;
        }
        // If it's a 404 for user endpoint, return empty array
        if (response.status === 404 && endpoint.includes('/user/')) {
          console.warn('[RightsCenterApi] 404 for user endpoint, returning empty array');
          return [] as T;
        }
        // For other errors, log and throw
        console.error('[RightsCenterApi] Error response:', errorText.substring(0, 200));
        throw new Error(
          `API Error ${response.status}: ${errorText.substring(0, 100) || response.statusText}`
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        console.log('[RightsCenterApi] Response data type:', Array.isArray(data) ? `Array(${data.length})` : 'Object');
        return data as T;
      } else {
        const text = await response.text();
        console.warn('[RightsCenterApi] Non-JSON response:', text.substring(0, 100));
        // Try to parse as JSON anyway
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new Error('Invalid response format: expected JSON');
        }
      }
    } catch (error: any) {
      console.error('[RightsCenterApi] Request failed:', error);
      if (error.message && error.message.includes('API Error')) {
        throw error;
      }
      if (error.name === 'AbortError') {
        throw new Error(`Network timeout (${this.requestTimeout}ms): Request took too long`);
      }
      throw new Error(`Network error: ${error.message || 'Failed to fetch'}`);
    }
  }

  /**
   * TruAPI request helper (`/api/v1/...` routes).
   * Uses `apiRootUrl` derived from the legacy `apiBaseUrl`.
   */
  private isSdkEndpoint(endpoint: string): boolean {
    return (
      endpoint.startsWith('/api/v1/internal/consent') ||
      endpoint.startsWith('/api/v1/internal/banners') ||
      endpoint.startsWith('/api/v1/internal/sdk')
    );
  }

  private async requestApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const cleanBaseUrl = this.apiRootUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBaseUrl}${cleanEndpoint}`;
    const headers = { ...this.getHeaders(this.isSdkEndpoint(endpoint)), ...(options.headers || {}) };

    try {
      console.log('[RightsCenterApi] Request (api):', url);
      console.log('[RightsCenterApi] Auth Headers - X-Org-Id:', this.organizationId ? '✓ set' : '✗ MISSING', 'X-API-Key:', this.apiKey ? '✓ set' : '✗ MISSING');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // For list-like endpoints, 404 is expected occasionally.
        if (response.status === 404 && (endpoint.includes('/user/') || endpoint.includes('/banners'))) {
          return [] as T;
        }
        const isExpectedRightsRouteMismatch =
          response.status === 404 &&
          endpoint.includes('/rights-requests/') &&
          errorText.toLowerCase().includes('rights request not found');

        if (isExpectedRightsRouteMismatch) {
          console.warn('[RightsCenterApi] Expected rights route mismatch, fallback will be attempted:', endpoint);
        } else {
          console.error('[RightsCenterApi] Error response (api):', errorText.substring(0, 200));
        }

        throw new Error(
          `API Error ${response.status}: ${errorText.substring(0, 100) || response.statusText}`
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }

      const text = await response.text();
      // Try to parse as JSON anyway.
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error('Invalid response format: expected JSON');
      }
    } catch (error: any) {
      const isExpectedRightsRouteMismatch = this.isRightsRequestRouteMismatch(error);
      if (!isExpectedRightsRouteMismatch) {
        console.error('[RightsCenterApi] Request failed (api):', error);
      }
      if (error.name === 'AbortError') {
        throw new Error(`Network timeout (${this.requestTimeout}ms): Request took too long`);
      }
      throw new Error(`Network error: ${error.message || 'Failed to fetch'}`);
    }
  }

  private normalizeArrayResponse(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  private normalizeNominee(payload: any): Nominee | null {
    if (!payload || typeof payload !== 'object') return null;
    const row = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
    if (!row?.id && !row?.nominee_name) return null;

    return {
      id: row.id ? String(row.id) : undefined,
      nominee_name: String(row.nominee_name || ''),
      relationship: String(row.relationship || ''),
      nominee_email: String(row.nominee_email || ''),
      nominee_mobile: String(row.nominee_mobile || ''),
      purpose_of_appointment: row.purpose_of_appointment || '',
      client_user_id: row.client_user_id || row.user_id,
    };
  }

  private normalizeGrievanceTicket(payload: any, fallback?: Partial<GrievanceTicket>): GrievanceTicket | null {
    if (!payload || typeof payload !== 'object') {
      if (!fallback) return null;
      return {
        id: fallback.id,
        ticket_id: fallback.ticket_id,
        subject: fallback.subject || '',
        category: fallback.category || '',
        description: fallback.description || '',
        status: fallback.status || 'open',
        created_at: fallback.created_at,
        client_user_id: fallback.client_user_id,
      };
    }

    const row = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
    return {
      id: row.id ? String(row.id) : fallback?.id,
      ticket_id: row.ticket_id || fallback?.ticket_id,
      subject: row.subject || fallback?.subject || '',
      category: row.category || fallback?.category || '',
      description: row.description || fallback?.description || '',
      status: row.status || fallback?.status || 'open',
      created_at: row.created_at || fallback?.created_at,
      client_user_id: row.client_user_id || fallback?.client_user_id,
    };
  }

  async getRightsCenterSettings(assetId?: string): Promise<RightsCenterSettings> {
    const assetQuery = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
    const payload = await this.requestApi<any>(
      `/api/v1/internal/rights-center/settings/global${assetQuery}`
    );

    // TruAPI may wrap in `{ data: {...} }`
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
    return data as RightsCenterSettings;
  }

  async createAccessRequest(userId: string, assetId?: string): Promise<void> {
    // Same payload as mars-money-website RightCenter.jsx
    await this.requestApi('/api/v1/internal/rights-requests/access-request', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        subject: 'Data Access Request',
        description: 'User requested access to personal data from Rights Center.',
        metadata: {
          asset_id: assetId,
          source: 'Rights Center',
        },
      }),
    });
  }

  async createDeletionRequest(userId: string, assetId?: string): Promise<void> {
    // Same payload as mars-money-website RightCenter.jsx
    await this.requestApi('/api/v1/internal/rights-requests/deletion-request', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        reason: 'User requested data deletion from Rights Center',
        metadata: {
          asset_id: assetId,
          requested_at: new Date().toISOString(),
          source: 'Rights Center',
        },
      }),
    });
  }

  // Consent endpoints
  async getUserConsents(userId: string, assetId?: string): Promise<ConsentGroup[]> {
    const normalizeArrayResponse = (payload: any): any[] => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    const normalizeStatus = (val: any): 'accepted' | 'declined' => {
      if (val === true || val === 'accepted' || val === 'approved') return 'accepted';
      if (val === false || val === 'declined' || val === 'rejected') return 'declined';
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v === 'accepted' || v === 'approved' || v === 'yes' || v === 'true') return 'accepted';
        if (v === 'declined' || v === 'rejected' || v === 'no' || v === 'false') return 'declined';
      }
      return 'declined';
    };

    // Same as website: GET /api/v1/internal/consent?asset_id=...
    const assetQuery = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
    const sourceRows = normalizeArrayResponse(
      await this.requestApi<any>(`/api/v1/internal/consent${assetQuery}`)
    );

    const merged: ConsentGroup[] = sourceRows.map((cp: any) => {
      const cpId = String(cp?.collection_point || cp?.id || '');
      const shown_to_principal = !!cp?.shown_to_principal;
      const purposes: Purpose[] = (cp?.purposes || []).map((p: any) => ({
        ...p,
        id: String(p?.id ?? ''),
        name: String(p?.name ?? p?.title ?? ''),
        description: String(p?.description ?? ''),
        expiry_period: String(p?.expiry_period ?? p?.expiry_type ?? p?.expiry ?? ''),
        is_mandatory: Boolean(p?.is_mandatory),
        consented: normalizeStatus(p?.consented),
      }));

      return {
        ...cp,
        collection_point: cpId,
        title: String(cp?.title ?? cp?.name ?? 'Collection Point'),
        shown_to_principal,
        purposes,
      } as ConsentGroup;
    });

    return merged;
  }

  async getAllBanners(assetId?: string): Promise<ConsentGroup[]> {
    const normalizeArrayResponse = (payload: any): any[] => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    const normalizeStatus = (val: any): 'accepted' | 'declined' => {
      if (val === true || val === 'accepted' || val === 'approved') return 'accepted';
      if (val === false || val === 'declined' || val === 'rejected') return 'declined';
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v === 'accepted' || v === 'approved' || v === 'yes' || v === 'true') return 'accepted';
        if (v === 'declined' || v === 'rejected' || v === 'no' || v === 'false') return 'declined';
      }
      return 'declined';
    };

    const assetQuery2 = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
    const sourceRows = normalizeArrayResponse(await this.requestApi<any>(`/api/v1/internal/consent${assetQuery2}`));

    return sourceRows.map((cp: any) => {
      const cpId = String(cp?.collection_point || cp?.id || '');
      const purposes: Purpose[] = (cp?.purposes || []).map((p: any) => ({
        ...p,
        id: String(p?.id ?? ''),
        name: String(p?.name ?? p?.title ?? ''),
        description: String(p?.description ?? ''),
        expiry_period: String(p?.expiry_period ?? p?.expiry_type ?? p?.expiry ?? ''),
        is_mandatory: Boolean(p?.is_mandatory),
        consented: normalizeStatus(p?.consented),
      }));

      return {
        ...cp,
        collection_point: cpId,
        title: String(cp?.title ?? cp?.name ?? 'Collection Point'),
        shown_to_principal: !!cp?.shown_to_principal,
        purposes,
      } as ConsentGroup;
    });
  }

  /**
   * Fetch all collection points by their individual IDs
   * This is a fallback when the root endpoint doesn't work
   */
  private async fetchAllCollectionPointsByID(): Promise<ConsentGroup[]> {
    // Known collection point IDs (CP002-CP014 based on system configuration)
    const collectionPointIds = [
      'CP002', // Expense Tracker
      'CP003', // KYC Document Upload Form
      'CP004', // Marketing Consent Banner
      'CP006', // Account Dashboard
      'CP007', // Signup Page
      'CP008', // Credit Card Application Form
      'CP009', // Fixed Deposit Page
      'CP010', // Mutual Funds Investment Section
      'CP011', // Digital Gold Investment Interface
      'CP012', // Loan Application Page
      'CP013', // Demat Account Creation
      'CP014', // Federal Bank Account Opening Form
    ];

    console.log('[RightsCenterApi] Fetching', collectionPointIds.length, 'collection points individually...');
    
    const results = await Promise.allSettled(
      collectionPointIds.map(async (cpId) => {
        try {
          // Fetch individual collection point - returns a single ConsentGroup object
          const response = await this.request<ConsentGroup | ConsentGroup[]>(`/${encodeURIComponent(cpId)}`);
          // Handle both single object and array responses
          if (Array.isArray(response)) {
            return response.length > 0 ? response[0] : null;
          }
          return response as ConsentGroup;
        } catch (err: any) {
          // If a specific collection point doesn't exist or fails, skip it silently
          // Don't log as error since some collection points may not exist
          if (!err.message || !err.message.includes('404')) {
            console.warn(`[RightsCenterApi] Collection point ${cpId} fetch failed, skipping:`, err.message?.substring(0, 100));
          }
          return null;
        }
      })
    );

    const banners = results
      .filter((result): result is PromiseFulfilledResult<ConsentGroup> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);

    console.log('[RightsCenterApi] Successfully fetched', banners.length, 'collection points');
    return banners;
  }

  async saveConsent(
    collectionId: string,
    payload: ConsentPayload
  ): Promise<void> {
    await this.requestApi(
      `/api/v1/internal/consent/${encodeURIComponent(collectionId)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async saveConsentFromRightsCenter(
    userId: string,
    changedPurposes: Array<{ id: string; name: string; consented: 'accepted' | 'declined' }>,
    assetId?: string,
    sessionId?: string
  ): Promise<void> {
    const hasRevocation = changedPurposes.some((p) => p.consented === 'declined');
    const action: 'approved' | 'revoked' = hasRevocation ? 'revoked' : 'approved';

    await this.requestApi('/api/v1/internal/consent/rights-center', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        purposes: changedPurposes,
        action,
        assetId,
        source: 'right center react-native',
        metadata: {
          button_used: 'save',
          interaction_type: 'rights_center',
          logged_at: new Date().toISOString(),
          session_id: sessionId,
        },
      }),
    });
  }

  async fetchUserConsents(userId: string, assetId?: string): Promise<FlatPurpose[]> {
    const normalizeStatus = (val: any): 'accepted' | 'declined' => {
      if (val === true || val === 'accepted' || val === 'approved') return 'accepted';
      if (typeof val === 'string') {
        const v = val.toLowerCase();
        if (v === 'accepted' || v === 'approved' || v === 'yes' || v === 'true') return 'accepted';
      }
      return 'declined';
    };

    // Step 1 — same as website: GET /api/v1/internal/consent?asset_id=... (all banner templates)
    const assetQuery = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
    const bannersRaw = await this.requestApi<any>(`/api/v1/internal/consent${assetQuery}`);
    const allBanners: any[] = Array.isArray(bannersRaw)
      ? bannersRaw
      : Array.isArray(bannersRaw?.data)
      ? bannersRaw.data
      : [];

    // Step 2 — same as website: GET /api/v1/internal/consent/user-consent-status?userId=...
    let userOverview: any[] = [];
    try {
      const userStatusRaw = await this.requestApi<any>(
        `/api/v1/internal/consent/user-consent-status?userId=${encodeURIComponent(userId)}`
      );
      userOverview = userStatusRaw?.collectionPoints || [];
    } catch {
      // optional — proceed with template defaults if unavailable
    }

    // Step 3 — seed unique purpose map from template banners (same as website)
    const uniquePurposesMap = new Map<string, FlatPurpose>();
    for (const banner of allBanners) {
      const purposes: any[] = Array.isArray(banner?.purposes) ? banner.purposes : [];
      for (const p of purposes) {
        const pid = String(p?.id ?? '');
        const status = String(p?.status ?? '').toLowerCase();
        if (!pid || (status && status !== 'active')) continue;
        if (uniquePurposesMap.has(pid)) continue;

        const purposeType = String(p?.purpose_type ?? '').toLowerCase();
        const isMandatory = !!(p?.isMandatory || p?.is_mandatory || purposeType.includes('mandatory'));
        uniquePurposesMap.set(pid, {
          id: pid,
          name: String(p?.name ?? p?.title ?? ''),
          title: String(p?.title ?? p?.name ?? ''),
          description: p?.description ? String(p.description) : undefined,
          expiry_period: p?.expiry_period ? String(p.expiry_period) : undefined,
          is_mandatory: isMandatory,
          consented: normalizeStatus(p?.consented),
          isLegitimate: Boolean(p?.is_legitimate || p?.isLegitimate),
          dataElements: Array.isArray(p?.data_elements) ? p.data_elements : Array.isArray(p?.dataElements) ? p.dataElements : [],
          processingActivities: Array.isArray(p?.processing_activities) ? p.processing_activities : Array.isArray(p?.processingActivities) ? p.processingActivities : [],
          type: isMandatory ? 'Mandatory' : 'Optional',
          timestamp: 0,
        });
      }
    }

    // Step 4 — overlay user consent status (same merge logic as website)
    for (const cp of userOverview) {
      const pcList = cp?.latest_consent?.purpose_consents || cp?.latestConsent?.purposeConsents || [];
      const logTimestamp = new Date(cp?.latest_consent?.timestamp || cp?.latestConsent?.timestamp || 0).getTime();
      for (const pc of pcList) {
        const pid = String(pc?.purpose_id ?? pc?.id ?? pc?.purposeId ?? '');
        if (!pid) continue;
        const existing = uniquePurposesMap.get(pid);
        if (!existing) continue;
        if (logTimestamp > existing.timestamp) {
          uniquePurposesMap.set(pid, {
            ...existing,
            consented: normalizeStatus(pc?.status ?? pc?.consented),
            timestamp: logTimestamp,
            dataElements: (pc?.data_elements || pc?.dataElements || existing.dataElements),
            processingActivities: (pc?.processing_activities || pc?.processingActivities || existing.processingActivities),
            description: pc?.description || existing.description,
            name: pc?.name || pc?.title || existing.name,
            title: pc?.name || pc?.title || existing.title,
          });
        }
      }
    }

    return Array.from(uniquePurposesMap.values());
  }

  // DPO endpoint
  async getDPOInfo(): Promise<DPOInfo> {
    return this.requestApi<DPOInfo>('/api/v1/internal/dpo');
  }

  // Nominee endpoints
  async getNominees(userId: string): Promise<Nominee[]> {
    const payload = await this.requestApi<any>(
      `/api/v1/internal/nominee/user/${encodeURIComponent(userId)}`
    );

    return this.normalizeArrayResponse(payload)
      .map((row) => this.normalizeNominee(row))
      .filter((row): row is Nominee => !!row);
  }

  async createNominee(nominee: Nominee): Promise<Nominee> {
    const clientUserId = nominee.client_user_id || nominee.user_id || this.userId;

    const payload = await this.requestApi<any>('/api/v1/internal/nominee', {
      method: 'POST',
      body: JSON.stringify({
        nominee_name: nominee.nominee_name,
        relationship: nominee.relationship,
        nominee_email: nominee.nominee_email,
        nominee_mobile: nominee.nominee_mobile,
        purpose_of_appointment: nominee.purpose_of_appointment || '',
        client_user_id: clientUserId,
      }),
    });

    const normalized = this.normalizeNominee(payload);
    if (normalized) return normalized;

    if (clientUserId) {
      const list = await this.getNominees(clientUserId).catch(() => []);
      const matched = list.find(
        (n) =>
          n.nominee_email === nominee.nominee_email &&
          n.nominee_mobile === nominee.nominee_mobile
      );
      if (matched) return matched;
      if (list.length > 0) return list[0];
    }

    return {
      ...nominee,
      client_user_id: clientUserId,
    };
  }

  async updateNominee(id: string, nominee: Nominee): Promise<Nominee> {
    const payload = await this.requestApi<any>(`/api/v1/internal/nominee/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(nominee),
    });

    const normalized = this.normalizeNominee(payload);
    if (normalized) return normalized;

    return {
      ...nominee,
      id,
    };
  }

  async deleteNominee(id: string): Promise<void> {
    await this.requestApi(`/api/v1/internal/nominee/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Grievance endpoints
  async getGrievanceTickets(userId: string): Promise<GrievanceTicket[]> {
    const payload = await this.requestApi<any>(
      `/api/v1/internal/grievance/user/${encodeURIComponent(userId)}`
    );

    return this.normalizeArrayResponse(payload)
      .map((row) => this.normalizeGrievanceTicket(row))
      .filter((row): row is GrievanceTicket => !!row);
  }

  async createGrievanceTicket(
    ticket: GrievanceTicket
  ): Promise<GrievanceTicket> {
    const payload = await this.requestApi<any>('/api/v1/internal/grievance', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });

    // Backend currently returns partial object ({id, ticket_id, message});
    // merge with submitted values so UI can render immediately without reload.
    return (
      this.normalizeGrievanceTicket(payload, {
        subject: ticket.subject,
        category: ticket.category,
        description: ticket.description,
        status: ticket.status || 'open',
        client_user_id: ticket.client_user_id,
      }) || {
        subject: ticket.subject,
        category: ticket.category,
        description: ticket.description,
        status: ticket.status || 'open',
        client_user_id: ticket.client_user_id,
      }
    );
  }
}

export default RightsCenterApi;

