/**
 * Type definitions for TruConsent React Native SDK
 */

export interface Banner {
  banner_id: string;
  collection_point: string;
  version?: string;
  title: string;
  name?: string; // Alternative field name from API
  expiry_type?: string;
  asset?: Asset;
  purposes: Purpose[];
  data_elements?: DataElement[];
  legal_entities?: LegalEntity[];
  tools?: Tool[];
  processing_activities?: ProcessingActivity[];
  consent_type?: 'standard_consent' | 'cookie_consent' | 'general';
  cookie_config?: CookieConfig;
  banner_settings?: BannerSettings;
  organization?: Organization;
  organization_name?: string;
  cookie_data_elements?: DataElement[];
  show_purposes?: boolean;
  show_processors?: boolean;
  description?: string;
  // Re-consent fields
  reconsentMode?: boolean;
  reconsentCampaignId?: string;
  reconsentUiMode?: 'full_cp' | 'diff_only' | 'temp_profile';
  versionDiff?: any;
  reconsentSource?: string;
  expiryReconsentRequestId?: string;
  consentStatus?: string;
  collectionPoint?: string; // collection point ID for logging
}

export interface Purpose {
  id: string;
  name: string;
  description: string;
  is_mandatory: boolean;
  consented: 'accepted' | 'declined' | 'pending' | 'shown';
  expiry_period: string;
  expiry_label?: string;
  data_elements?: DataElement[];
  processing_activities?: ProcessingActivity[];
  legal_entities?: LegalEntity[];
  tools?: Tool[];
  // Extended fields
  is_legitimate?: boolean;
  is_dynamic?: boolean;
  frequency?: 'recurring' | 'one_off';
  purpose_type?: string;
  version?: string;
  // Computed after normalization
  isLegitimate?: boolean;
  isMandatory?: boolean;
  legalBasis?: 'notice' | 'consent';
  withdrawable?: boolean;
  isDynamic?: boolean;
}

export interface DataElement {
  id: string;
  name: string;
  description?: string;
  display_id?: string;
}

export interface LegalEntity {
  id: string;
  name: string;
  description?: string;
  display_id?: string;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  display_id?: string;
}

export interface ProcessingActivity {
  id: string;
  name: string;
  description?: string;
  display_id?: string;
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  asset_type?: string;
}

export interface CookieConfig {
  cookies?: Cookie[];
  selected_data_element_ids?: string[];
  selected_processing_activity_ids?: string[];
}

export interface Cookie {
  id?: string;
  name?: string;
  category?: string;
  domain?: string;
  expiry?: string;
}

export interface BannerSettings {
  font_type?: string;
  font_size?: string;
  primary_color?: string;
  secondary_color?: string;
  action_button_text?: string;
  warning_text?: string;
  logo_url?: string;
  banner_title?: string;
  disclaimer_text?: string;
  footer_text?: string;
  show_purposes?: boolean;
  // H-Case settings
  h_case_logging_strategy?: 'soft_first' | 'hard_immediate';
  h_case_warning_message?: string;
  h_case_proceed_button_text?: string;
  h_case_back_button_text?: string;
  h_case_proceed_button_color?: string;
  h_case_back_button_color?: string;
  // Default selection
  defaultSelection?: 'all' | 'mandatory_only' | 'none';
}

export interface Organization {
  name: string;
  legal_name?: string;
  trade_name?: string;
  logo_url?: string;
}

export type ConsentAction =
  | 'approved'
  | 'declined'
  | 'no_action'
  | 'revoked'
  | 'partial_consent'
  | 'notice_shown';

export interface ConsentRequest {
  userId: string;
  purposes: Purpose[];
  action: ConsentAction;
  requestId?: string;
}

export interface TruConsentConfig {
  apiKey?: string;
  organizationId: string;
  bannerId: string;
  userId: string;
  /**
   * Web SDK parity:
   * - Used as the base for routes like `/api/v1/banners/...` and `/api/v1/consent/...`.
   */
  apiUrl?: string;
  assetId?: string;
  /**
   * Web SDK parity: token-based auth.
   * If both are provided, `token` takes precedence.
   */
  token?: string;
  authToken?: string;
  logoUrl?: string;
  companyName?: string;
  onClose?: (action: ConsentAction) => void;
  onSubmit?: (payload: any) => void;
}
