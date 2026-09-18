/**
 * TruConsentModal - Main React Native component for displaying consent banner
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from '../utils/i18n';
import { TruConsentConfig, ConsentAction, Banner, Purpose } from '../core/types';
import {
  NormalizedPurpose,
  normalizePurposes,
  deriveUIState,
  UIState,
} from '../core/ConsentManager';
import { useBanner } from '../hooks/useBanner';
import { useConsent } from '../hooks/useConsent';
import { submitConsent, submitSuppression, DEFAULT_API_URL } from '../core/BannerService';
import { generateRequestId } from '../utils/RequestIdGenerator';
import { resolveTemplateKey } from '../core/templateRegistry';
import { deriveBannerThemeColors } from '../utils/ColorUtils';
import { getAvailableLanguages, createTranslator } from '../utils/translationSnapshot';
import BannerUI from './BannerUI';
import CookieBannerUI from './CookieBannerUI';
import PreferencesModalUI from './PreferencesModalUI';
import NoticeOnlyBanner from './NoticeOnlyBanner';
import CompactListUI from './CompactListUI';
import SplitPaneUI from './SplitPaneUI';
import InlineSingleRowUI from './InlineSingleRowUI';
import HCaseWarningModal from './HCaseWarningModal';

export default function TruConsentModal(props: TruConsentConfig) {
  const {
    apiKey,
    organizationId,
    bannerId,
    userId,
    apiUrl = DEFAULT_API_URL,
    assetId,
    token,
    authToken,
    logoUrl,
    companyName = 'Mars Company',
    onClose,
    onSubmit,
  } = props;

  const apiKeyValue = apiKey ?? '';

  const [visible, setVisible] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // Session & performance tracking
  const [sessionId] = useState(
    () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );
  const [requestId] = useState(() => generateRequestId());
  const bannerFetchAtRef = useRef<number>(0);
  const bannerDisplayedAtRef = useRef<number>(0);

  // H-Case state
  const [hCaseState, setHCaseState] = useState<{
    show: boolean;
    action: string | null;
    intendedPurposes: NormalizedPurpose[] | null;
    buttonUsed: string | null;
  }>({ show: false, action: null, intendedPurposes: null, buttonUsed: null });

  const actionTakenRef = useRef(false);
  const actionRunningRef = useRef(false);
  const closeButtonClickedRef = useRef(false);

  const bannerConfig = bannerId && (apiKeyValue || token || authToken) && organizationId && apiUrl
    ? {
        bannerId,
        apiKey: apiKeyValue,
        organizationId,
        apiUrl,
        assetId,
        userId,
        token,
        authToken,
      }
    : null;

  const { banner, isLoading, error: bannerError } = useBanner(bannerConfig);

  // Track when banner fetch completes
  useEffect(() => {
    if (banner && !isLoading) {
      bannerFetchAtRef.current = Date.now();
    }
  }, [banner, isLoading]);

  // Log banner state for debugging
  useEffect(() => {
    console.log('TruConsentModal - Banner state:', {
      isLoading,
      hasBanner: !!banner,
      error: bannerError,
      bannerId,
      purposesCount: banner?.purposes?.length || 0,
    });
  }, [isLoading, banner, bannerError, bannerId]);

  const defaultSelection: 'all' | 'mandatory_only' | 'none' =
    (banner?.banner_settings as any)?.defaultSelection ??
    (banner?.banner_settings as any)?.default_selection ??
    'mandatory_only';

  // Re-consent fields
  const reconsentCampaignId = (banner as any)?.reconsentCampaignId || null;
  const reconsentUiMode = (banner as any)?.reconsentUiMode || 'full_cp';
  const versionDiff = (banner as any)?.versionDiff || null;
  const reconsentSource = (banner as any)?.reconsentSource || 'version_update';
  const expiryReconsentRequestId = (banner as any)?.expiryReconsentRequestId || null;
  const isReconsentMode = !!(banner as any)?.reconsentMode;

  // Normalize purposes using ConsentManager
  const allNormalizedPurposes: NormalizedPurpose[] = useMemo(() => {
    const rawPurposes: any[] = Array.isArray(banner?.purposes) ? (banner!.purposes as any[]) : [];
    return normalizePurposes(rawPurposes, defaultSelection);
  }, [banner?.purposes, defaultSelection]);

  // Derive UI state
  const uiState: UIState = useMemo(
    () => deriveUIState(allNormalizedPurposes),
    [allNormalizedPurposes]
  );

  const noticePurposes = uiState.noticePurposes;
  const consentPurposes = uiState.consentPurposes;

  const { purposes, updatePurpose, setPurposes } = useConsent(consentPurposes as Purpose[]);
  const syncedPurposesKeyRef = useRef('');

  // Update purposes when banner loads
  useEffect(() => {
    const syncKey = JSON.stringify(
      consentPurposes.map((p) => ({
        id: p.id,
        consented: p.consented,
        is_mandatory: p.is_mandatory,
      }))
    );
    if (syncedPurposesKeyRef.current !== syncKey) {
      syncedPurposesKeyRef.current = syncKey;
      setPurposes(consentPurposes as Purpose[]);
    }
  }, [consentPurposes, setPurposes]);

  // Track when banner is displayed
  useEffect(() => {
    if (banner && !isLoading && bannerDisplayedAtRef.current === 0) {
      bannerDisplayedAtRef.current = Date.now();
    }
  }, [banner, isLoading]);

  // Auto-hide only when the CP has no purposes to show — not when already
  // consented. Matches truKIT-NPM's TruConsentModal.jsx exactly (see its
  // own comment there): users should always be able to reopen the banner
  // to view or update their preferences, so an already-complete
  // consentStatus must NOT auto-hide here. It previously did, and reported
  // 'no_action' when it fired — `isConsentActionSuccessful`-style callbacks
  // in consuming apps correctly treat 'no_action' as "no decision was
  // made", so a user who had *already consented* on a prior visit got a
  // false "Application Not Submitted — consent was rejected" error despite
  // never having declined anything, and despite the previous approval
  // still being the correct, current consent. If a consuming app wants to
  // skip showing the banner again after a completed decision, that's its
  // own responsibility to cache — truKIT-NPM's own consuming demos do this
  // themselves rather than relying on the SDK to guess.
  useEffect(() => {
    if (banner && !isLoading && !isReconsentMode) {
      const hasNoPurposes =
        !banner.purposes || banner.purposes.length === 0;
      if (hasNoPurposes) {
        console.log('Auto-hiding banner: no purposes to show');
        setVisible(false);
        if (onClose) onClose('no_action');
      }
    }
  }, [banner, isLoading, isReconsentMode]);

  // Derive company / logo from banner.organization when available
  const resolvedCompanyName =
    (banner && (banner.organization_name || banner.organization?.name)) || companyName;
  const resolvedLogoUrl = (banner && banner.organization?.logo_url) || logoUrl;

  const resolvedTemplateKey = resolveTemplateKey(
    (banner?.banner_settings as any)?.general_notice_template,
    { consentType: banner?.consent_type }
  );

  const primaryColor =
    (banner?.banner_settings as any)?.primary_color || '#3b82f6';

  // "Common Appearance" theme (background/text/button colors, font) from the
  // admin dashboard, applied throughout BannerUI and its children.
  const bannerTheme = deriveBannerThemeColors((banner?.banner_settings as any) || {});

  // Server-driven translations for dynamic content (purpose names, banner
  // title/disclaimer/footer) — the language list and translated text both
  // come from the API's snapshot, not a fixed built-in set of languages.
  const translationSnapshot =
    (banner as any)?.translationsSnapshot || (banner as any)?.translations_snapshot;
  const { availableLanguages, languageLabels } = useMemo(
    () => getAvailableLanguages(translationSnapshot),
    [translationSnapshot]
  );
  const translate = useMemo(
    () => createTranslator(translationSnapshot, selectedLanguage),
    [translationSnapshot, selectedLanguage]
  );

  const hCaseStrategy: 'soft_first' | 'hard_immediate' =
    (banner?.banner_settings as any)?.h_case_logging_strategy ?? 'soft_first';

  const close = (type: ConsentAction) => {
    setVisible(false);
    if (onClose) onClose(type);
  };

  // Build notice purposes payload (legitimate purposes always logged as 'shown')
  const noticePurposesPayload: Purpose[] = noticePurposes.map((p) => ({
    ...p,
    consented: 'shown' as const,
    purposeId: p.id,
    version: p.version ?? 'v1.0',
    purpose_type: p.purpose_type ?? 'legitimate_interest',
    is_mandatory: p.is_mandatory,
  }));

  const buildConsentPurposesPayload = (purposeList: Purpose[]): any[] =>
    purposeList.map((p) => {
      const norm = p as NormalizedPurpose;
      return {
        purposeId: p.id,
        version: (p as any).version ?? 'v1.0',
        consented: norm.isLegitimate ? 'shown' : p.consented,
        purpose_type: norm.isLegitimate
          ? 'legitimate_interest'
          : (p as any).purpose_type ?? 'consent',
        is_mandatory: p.is_mandatory,
      };
    });

  const buildAllPurposesPayload = (consentPurposesPayload: Purpose[]) => [
    ...buildConsentPurposesPayload(noticePurposesPayload),
    ...buildConsentPurposesPayload(consentPurposesPayload),
  ];

  const buildMetadata = (
    buttonUsed: string,
    extra?: Record<string, any>
  ): Record<string, any> => {
    const now = Date.now();
    return {
      sessionId,
      button_used: buttonUsed,
      collection_point_version: banner?.version ?? 'v1.0',
      reconsent_campaign_id: reconsentCampaignId,
      expiry_reconsent_request_id: expiryReconsentRequestId,
      performance: {
        banner_fetched_at: bannerFetchAtRef.current
          ? Math.floor(bannerFetchAtRef.current / 1000)
          : null,
        banner_displayed_at: bannerDisplayedAtRef.current
          ? Math.floor(bannerDisplayedAtRef.current / 1000)
          : null,
        user_interaction_at: Math.floor(now / 1000),
        notice_logged_at: null,
      },
      ...extra,
    };
  };

  const submitPurposes = async (
    action: ConsentAction,
    purposesPayload: any[],
    metadata?: Record<string, any>
  ) => {
    if (!banner || actionRunningRef.current) return;

    if (action !== 'no_action') {
      actionTakenRef.current = true;
    }

    actionRunningRef.current = true;
    try {
      const collectionPointId = banner.collectionPoint || banner.collection_point;

      if (onSubmit) {
        // Custom submit handler - skip suppression too
        onSubmit({
          userId,
          requestId,
          assetId,
          consentLanguage: 'en',
          collectionPointId,
          collectionPointVersion: banner?.version ?? 'v1.0',
          consentTimestamp: Math.floor(Date.now() / 1000),
          source: 'react-native',
          purposes: purposesPayload,
          action,
          metadata,
        });
      } else {
        await submitConsent({
          collectionPointId,
          userId,
          purposes: purposesPayload,
          action,
          apiKey: apiKeyValue,
          organizationId,
          requestId,
          apiUrl,
          assetId,
          token,
          authToken,
          metadata,
          consentLanguage: 'en',
          collectionPointVersion: banner?.version ?? 'v1.0',
          consentTimestamp: Math.floor(Date.now() / 1000),
          source: 'react-native',
        });
      }
    } catch (e: any) {
      console.error('Failed to log consent event:', e);
      throw e;
    } finally {
      actionRunningRef.current = false;
    }
  };

  const fireSuppressionIfNeeded = (purposesPayload: Purpose[]) => {
    if (onSubmit) return; // skip for custom handlers
    if (!apiUrl) return;

    const declinedPurposeIds = purposesPayload
      .filter((p) => p.consented === 'declined')
      .map((p) => p.id);

    if (declinedPurposeIds.length > 0) {
      void submitSuppression({
        apiUrl,
        apiKey: apiKeyValue,
        organizationId,
        token,
        authToken,
        userId,
        declinedPurposeIds,
      });
    }
  };

  // ---- H-Case intercept ----
  const checkHCaseIntercept = (purposesList: Purpose[]): boolean => {
    // Returns true if any mandatory consent purpose is declined
    return purposesList.some(
      (p) => p.is_mandatory && p.consented === 'declined'
    );
  };

  // Cleanup effect to record "no_action" ONLY if close button was clicked
  useEffect(() => {
    return () => {
      if (
        closeButtonClickedRef.current &&
        !actionTakenRef.current &&
        banner &&
        !actionRunningRef.current
      ) {
        const consentPayload = purposes.map((p) => ({ ...p, consented: 'declined' as const }));
        void submitPurposes('no_action', buildAllPurposesPayload(consentPayload), buildMetadata('close'));
      }
    };
  }, [banner]);

  // Debug logging
  useEffect(() => {
    if (banner) {
      console.log('Banner loaded in modal:', {
        bannerId: banner.banner_id,
        title: banner.title || banner.name,
        purposesCount: banner.purposes?.length || 0,
        consentType: banner.consent_type,
        hasSettings: !!banner.banner_settings,
        uiState: {
          bannerCase: uiState.bannerCase,
          noticeOnly: uiState.noticeOnly,
        },
      });
    }
  }, [banner]);

  // ---- Action handlers ----

  const handleRejectAll = async () => {
    if (!banner) return;
    const consentPayload: Purpose[] = purposes.map((p) => ({ ...p, consented: 'declined' as const }));

    // H-Case intercept
    if (checkHCaseIntercept(consentPayload)) {
      setHCaseState({
        show: true,
        action: 'declined',
        intendedPurposes: consentPayload as NormalizedPurpose[],
        buttonUsed: 'reject_all',
      });
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const meta = buildMetadata('reject_all');
      await submitPurposes('declined', buildAllPurposesPayload(consentPayload), meta);
      fireSuppressionIfNeeded(consentPayload);
      close('declined');
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConsentAll = async () => {
    if (!banner) return;
    setActionLoading(true);
    setError(null);
    try {
      const consentPayload: Purpose[] = purposes.map((p) => ({ ...p, consented: 'accepted' as const }));
      const meta = buildMetadata('accept_all');
      await submitPurposes('approved', buildAllPurposesPayload(consentPayload), meta);
      close('approved');
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptSelected = async () => {
    if (!banner) return;

    // ModernBannerActions.tsx's dynamic third button reuses this single
    // handler for two distinct modes, decided by the label the user just
    // saw: "Only Necessary" (no optional purpose currently accepted) or
    // "Accept Selected" (at least one is). Must be computed from the
    // *current* state before building the payload — the same check
    // ModernBannerActions.tsx's own `hasOptionalAccepted` uses for the
    // label — so the two can never disagree about which mode is active.
    const anyOptionalAccepted = purposes.some(
      (p) => !p.is_mandatory && p.consented === 'accepted'
    );

    const consentPayload: Purpose[] = purposes.map((p) => {
      if (p.is_mandatory) return { ...p, consented: 'accepted' as const };
      // "Only Necessary" mode: force every optional purpose to declined
      // regardless of its current toggle state — matches truKIT-NPM's
      // reference `onlyNecessary` handler (useConsentEngine.js) and this
      // file's own handleAcceptMandatory. Without this, an optional purpose
      // that already reads 'accepted' (e.g. a `defaultSelection` other than
      // 'mandatory_only', or a residual toggle) makes the submitted action
      // 'approved' even though the button visibly read "Only Necessary".
      return anyOptionalAccepted ? p : { ...p, consented: 'declined' as const };
    });

    // If user clicked "Save Preferences" determine if it's really onlyNecessary
    const buttonUsed = anyOptionalAccepted ? 'save_preferences' : 'only_necessary';

    // H-Case intercept on save_preferences
    if (buttonUsed === 'save_preferences' && checkHCaseIntercept(consentPayload)) {
      setHCaseState({
        show: true,
        action: null,
        intendedPurposes: consentPayload as NormalizedPurpose[],
        buttonUsed,
      });
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const allAccepted = consentPayload.every((p) => p.consented === 'accepted');
      const allDeclined = consentPayload.every((p) => p.consented === 'declined');

      const consentAction: ConsentAction =
        consentPayload.length === 0
          ? 'no_action'
          : allAccepted
          ? 'approved'
          : allDeclined
          ? 'declined'
          : 'partial_consent';

      const meta = buildMetadata(buttonUsed);
      await submitPurposes(consentAction, buildAllPurposesPayload(consentPayload), meta);
      fireSuppressionIfNeeded(consentPayload);
      close(consentAction);
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Unlike handleAcceptSelected (which respects the user's current toggles),
  // this forces every optional purpose to declined regardless of its current
  // state — a true "Only Necessary" action, used by templates (e.g.
  // PreferencesModalUI) that expose it as a distinct button from
  // "Save Preferences".
  const handleAcceptMandatory = async () => {
    if (!banner) return;

    const consentPayload: Purpose[] = purposes.map((p) => ({
      ...p,
      consented: p.is_mandatory ? ('accepted' as const) : ('declined' as const),
    }));

    setActionLoading(true);
    setError(null);
    try {
      const hasOptional = consentPayload.some((p) => !p.is_mandatory);
      const consentAction: ConsentAction = hasOptional ? 'partial_consent' : 'approved';
      const meta = buildMetadata('only_necessary');
      await submitPurposes(consentAction, buildAllPurposesPayload(consentPayload), meta);
      fireSuppressionIfNeeded(consentPayload);
      close(consentAction);
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgeNotice = async () => {
    if (!banner) return;
    setActionLoading(true);
    setError(null);
    try {
      // Notice-only flow: all purposes consented = 'shown', action = 'notice_shown'
      const noticePurposesShown = allNormalizedPurposes.map((p) => ({
        purposeId: p.id,
        version: p.version ?? 'v1.0',
        consented: 'shown' as const,
        purpose_type: p.purpose_type ?? (p.isLegitimate ? 'legitimate_interest' : 'consent'),
        is_mandatory: p.is_mandatory,
      }));
      const meta = buildMetadata('i_understand');
      await submitPurposes('notice_shown', noticePurposesShown, meta);
      close('notice_shown');
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseClick = () => {
    closeButtonClickedRef.current = true;
    if (!actionTakenRef.current) {
      const consentPayload = purposes.map((p) => ({ ...p, consented: 'declined' as const }));
      void submitPurposes(
        'no_action',
        buildAllPurposesPayload(consentPayload),
        buildMetadata('close')
      );
      actionTakenRef.current = true;
    }
    close('no_action');
  };

  // ---- H-Case proceed ----
  const handleHCaseProceed = async () => {
    setHCaseState((s) => ({ ...s, show: false }));
    if (!banner || !hCaseState.intendedPurposes) return;

    setActionLoading(true);
    setError(null);
    try {
      const consentPayload = hCaseState.intendedPurposes as Purpose[];
      const allDeclined = consentPayload.every((p) => p.consented === 'declined');
      const allAccepted = consentPayload.every((p) => p.consented === 'accepted');
      const consentAction: ConsentAction = allDeclined
        ? 'declined'
        : allAccepted
        ? 'approved'
        : 'partial_consent';

      const meta = buildMetadata('h_case_proceed', {
        h_case_warning_shown: true,
        h_case_acknowledged: true,
      });
      await submitPurposes(consentAction, buildAllPurposesPayload(consentPayload), meta);
      fireSuppressionIfNeeded(consentPayload);
      close(consentAction);
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHCaseBack = () => {
    setHCaseState({ show: false, action: null, intendedPurposes: null, buttonUsed: null });
  };

  // Conditional return - must be AFTER all hooks
  if (!visible) return null;

  const displayError = error || bannerError;

  return (
    <I18nextProvider i18n={i18n}>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseClick}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseClick}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading banner...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                {displayError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                      {displayError.includes('Banner not found')
                        ? 'Banner not found. Please check the Banner ID and try again.'
                        : displayError.includes('Unauthorized') || displayError.includes('Invalid') || displayError.includes('missing API key')
                        ? 'Authentication failed. Please check your API key and Organization ID.'
                        : displayError.includes('Forbidden') || displayError.includes('not authorized')
                        ? 'Access denied. Your API key does not have permission to access this banner.'
                        : displayError.includes('Rate limit')
                        ? 'Rate limit exceeded. Please try again later.'
                        : `Error: ${displayError}`}
                    </Text>
                    <Text style={styles.errorSubtext}>
                      Please check your API credentials and banner ID, then try again.
                    </Text>
                  </View>
                )}

                {!displayError && !banner && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>No banner data available</Text>
                  </View>
                )}

                {!displayError && banner && (
                  <>
                    {resolvedTemplateKey === 'notice_only' &&
                    noticePurposesPayload.length === 0 &&
                    allNormalizedPurposes.length === 0 ? (
                      <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>No notice content available</Text>
                      </View>
                    ) : resolvedTemplateKey === 'notice_only' ? (
                      <NoticeOnlyBanner
                        banner={{ ...banner, purposes: purposes as Purpose[] }}
                        companyName={resolvedCompanyName}
                        logoUrl={resolvedLogoUrl}
                        onAcknowledge={handleAcknowledgeNotice}
                        primaryColor={primaryColor}
                      />
                    ) : resolvedTemplateKey === 'floating_card' ? (
                      <CookieBannerUI
                        banner={banner}
                        companyName={resolvedCompanyName}
                        logoUrl={resolvedLogoUrl}
                        onRejectAll={handleRejectAll}
                        onConsentAll={handleConsentAll}
                      />
                    ) : resolvedTemplateKey === 'preferences_modal' ? (
                      <PreferencesModalUI
                        banner={{ ...banner, purposes: purposes as Purpose[] }}
                        companyName={resolvedCompanyName}
                        logoUrl={resolvedLogoUrl}
                        onChangePurpose={updatePurpose}
                        onAcceptMandatory={handleAcceptMandatory}
                        onAcceptSelected={handleAcceptSelected}
                        onConsentAll={handleConsentAll}
                        primaryColor={primaryColor}
                      />
                    ) : resolvedTemplateKey === 'general_compact_list' ? (
                      <CompactListUI
                        banner={{ ...banner, purposes: purposes as Purpose[] }}
                        companyName={resolvedCompanyName}
                        logoUrl={resolvedLogoUrl}
                        onChangePurpose={updatePurpose}
                        onRejectAll={handleRejectAll}
                        onConsentAll={handleConsentAll}
                        onAcceptSelected={handleAcceptSelected}
                        primaryColor={primaryColor}
                      />
                    ) : resolvedTemplateKey === 'general_split_pane' ? (
                      <SplitPaneUI
                        banner={{ ...banner, purposes: purposes as Purpose[] }}
                        companyName={resolvedCompanyName}
                        logoUrl={resolvedLogoUrl}
                        onChangePurpose={updatePurpose}
                        onRejectAll={handleRejectAll}
                        onConsentAll={handleConsentAll}
                        onAcceptSelected={handleAcceptSelected}
                        primaryColor={primaryColor}
                      />
                    ) : resolvedTemplateKey === 'inline_single_row' ? (
                      <InlineSingleRowUI
                        banner={{ ...banner, purposes: purposes as Purpose[] }}
                        companyName={resolvedCompanyName}
                        logoUrl={resolvedLogoUrl}
                        onChangePurpose={updatePurpose}
                        onRejectAll={handleRejectAll}
                        onConsentAll={handleConsentAll}
                        onAcceptSelected={handleAcceptSelected}
                        primaryColor={primaryColor}
                      />
                    ) : (
                      <BannerUI
                        banner={{ ...banner, purposes: purposes as Purpose[] }}
                        companyName={resolvedCompanyName}
                        logoUrl={resolvedLogoUrl}
                        theme={bannerTheme}
                        translate={translate}
                        selectedLanguage={selectedLanguage}
                        availableLanguages={availableLanguages}
                        languageLabels={languageLabels}
                        onLanguageChange={setSelectedLanguage}
                        onChangePurpose={updatePurpose}
                        onRejectAll={handleRejectAll}
                        onConsentAll={handleConsentAll}
                        onAcceptSelected={handleAcceptSelected}
                        uiState={uiState}
                        primaryColor={primaryColor}
                        onAcknowledgeNotice={handleAcknowledgeNotice}
                      />
                    )}
                    {(!banner.purposes || banner.purposes.length === 0) && (
                      <View style={styles.warningContainer}>
                        <Text style={styles.warningText}>
                          Warning: No purposes found in banner data
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* H-Case Warning Modal */}
      <HCaseWarningModal
        visible={hCaseState.show}
        strategy={hCaseStrategy}
        message={(banner?.banner_settings as any)?.h_case_warning_message}
        proceedText={(banner?.banner_settings as any)?.h_case_proceed_button_text || 'Proceed Anyway'}
        backText={(banner?.banner_settings as any)?.h_case_back_button_text || 'Go Back'}
        onProceed={handleHCaseProceed}
        onBack={handleHCaseBack}
        primaryColor={primaryColor}
        proceedColor={(banner?.banner_settings as any)?.h_case_proceed_button_color}
        backColor={(banner?.banner_settings as any)?.h_case_back_button_color}
      />
    </I18nextProvider>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isMobile ? 12 : 20,
    paddingTop: isMobile ? 20 : 28,
    paddingBottom: isMobile ? 20 : 28,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: isMobile ? '96%' : '90%',
    maxWidth: 720,
    height: isMobile ? SCREEN_HEIGHT - 80 : undefined,
    maxHeight: isMobile ? SCREEN_HEIGHT - 80 : SCREEN_HEIGHT * 0.9,
    padding: isMobile ? 20 : 24,
    minHeight: isMobile ? SCREEN_HEIGHT * 0.75 : 200,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '600',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 32,
    flexGrow: 1,
    minHeight: '100%',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  errorSubtext: {
    color: '#991b1b',
    fontSize: 12,
    marginTop: 4,
  },
  warningContainer: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  warningText: {
    color: '#92400e',
    fontSize: 12,
  },
  noticePurposeCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  noticePurposeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  noticePurposeDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  noticeAcknowledgeButton: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  noticeAcknowledgeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
