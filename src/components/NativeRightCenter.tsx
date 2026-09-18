/**
 * NativeRightCenter - Native implementation of Rights Center
 * Replaces WebView with native React Native components
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import RightsCenterApi, {
  ConsentGroup,
  FlatPurpose,
  DPOInfo,
  Nominee,
  GrievanceTicket,
  GrievanceMessage,
  ConsentPayload,
} from '../services/rightsCenterApi';
import { deriveThemeColors } from '../utils/ColorUtils';
import { DEFAULT_API_URL } from '../core/BannerService';

export interface NativeRightCenterProps {
  /** The signed-in user's id (SSO mode). Omit this when the Rights Center's
   * global settings have `access_mode: 'non_sso'` — in that case the widget
   * itself authenticates the user via a phone + OTP flow before showing any
   * tab content, and the resulting data principal id is used in its place. */
  userId?: string;
  apiKey?: string;
  organizationId?: string;
  apiUrl?: string;
  assetId?: string;
  token?: string;
  authToken?: string;
}

const DEFAULT_RIGHTS_CENTER_SETTINGS: Partial<import('../services/rightsCenterApi').RightsCenterSettings> = {
  background_color: '#020617',
  primary_text_color: '#e5e7eb',
  secondary_text_color: '#9ca3af',
  button_color: '#65a30d',
  button_text_color: '#0b1120',
  font_family: 'sans-serif',

  show_consents_section: true,
  show_rights_section: true,
  show_nominees_section: true,
  show_transparency_section: false,
  show_dpo_section: false,
  show_grievance_section: true,

  grievance_mode: 'truconsent',
  grievance_external_url: '',

  consents_section_title: 'Consents',
  rights_section_title: 'Your Data Rights',
  nominees_section_title: 'Nominees',
  transparency_description: '',

  dpo_qualifications_enabled: true,
  dpo_responsibilities_enabled: true,
  dpo_working_hours_enabled: true,
  dpo_response_time_enabled: true,
};

export default function NativeRightCenter({
  userId,
  apiKey = '',
  organizationId = '',
  apiUrl,
  assetId,
  token,
  authToken,
}: NativeRightCenterProps) {
  const [rightsCenterSettings, setRightsCenterSettings] = useState(
    DEFAULT_RIGHTS_CENTER_SETTINGS as any
  );
  const [isInitializing, setIsInitializing] = useState(true);

  const [activeTab, setActiveTab] = useState('Consent');

  // Single API instance — same key for all calls, same as website
  const [api] = useState(
    () =>
      new RightsCenterApi(
        apiUrl ?? DEFAULT_API_URL,
        apiKey,
        organizationId,
        userId,
        token ?? authToken
      )
  );

  // ─── Non-SSO OTP authentication state ────────────────────────────────────────
  const [internalAuth, setInternalAuth] = useState<{
    accessToken: string;
    dataPrincipalId: string;
  } | null>(null);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpResendsUsed, setOtpResendsUsed] = useState(0);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [nonSsoDismissed, setNonSsoDismissed] = useState(false);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // The user id to act as: the SSO-supplied prop, or (once verified) the
  // non-SSO OTP flow's data principal id.
  const effectiveUserId = userId || internalAuth?.dataPrincipalId || '';

  // True while non-SSO access is configured, no SSO userId was supplied, and
  // the user hasn't completed OTP verification yet. Used to gate data
  // fetching (regardless of whether the OTP UI is visible or dismissed).
  const needsNonSsoAuth =
    !userId && rightsCenterSettings.access_mode === 'non_sso' && !internalAuth;

  // True when the phone/OTP screen should actually be rendered: same as
  // needsNonSsoAuth, but also respects the user dismissing it (the "X" close
  // button) — mirrors the NPM SDK's `showNonSsoModal`.
  const showOtpGate = needsNonSsoAuth && !nonSsoDismissed;

  // True when access is SSO (the default — any access_mode other than
  // 'non_sso') but no identity has been resolved at all: the integrating app
  // simply never supplied a userId. Mirrors the NPM SDK's condition for
  // showing "Please log in to view your Rights Center." instead of empty/
  // broken tab content.
  const needsSsoLogin =
    !userId && !internalAuth && rightsCenterSettings.access_mode !== 'non_sso';

  // Non-SSO sessions are read-only in the Consent tab per the NPM SDK.
  const isNonSsoReadOnly = !userId && !!internalAuth;

  const sendOtp = async () => {
    if (!phone.trim()) {
      setOtpError('Enter a phone number');
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      await api.sendOtp(phone.trim(), countryCode.trim(), assetId);
      setOtpSent(true);
      setOtpCooldown(30);
    } catch (e) {
      setOtpError('Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const resendOtp = async () => {
    if (otpResendsUsed >= 3 || otpCooldown > 0) return;
    setOtpResendsUsed((n) => n + 1);
    await sendOtp();
  };

  const verifyOtp = async () => {
    if (otp.trim().length < 4) {
      setOtpError('Enter the OTP you received');
      return;
    }
    setOtpVerifying(true);
    setOtpError(null);
    try {
      const result = await api.verifyOtp(phone.trim(), countryCode.trim(), otp.trim(), assetId);
      setInternalAuth({ accessToken: result.accessToken, dataPrincipalId: result.dataPrincipalId });
    } catch (e) {
      setOtpError('Incorrect or expired OTP. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  // Generate a stable session ID for this Rights Center session
  const [sessionId] = useState(() => `rn-rc-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const theme = useMemo(
    () => deriveThemeColors({
      background_color: rightsCenterSettings.background_color,
      primary_text_color: rightsCenterSettings.primary_text_color,
      secondary_text_color: rightsCenterSettings.secondary_text_color,
      button_color: rightsCenterSettings.button_color,
      button_text_color: rightsCenterSettings.button_text_color,
    }),
    [rightsCenterSettings]
  );

  const tabs = useMemo(() => {
    const tabConfig = [
      { label: 'Consent', enabled: rightsCenterSettings.show_consents_section !== false },
      { label: 'Rights', enabled: rightsCenterSettings.show_rights_section !== false },
      { label: 'Nominee', enabled: rightsCenterSettings.show_nominees_section !== false },
      { label: 'Grievance', enabled: rightsCenterSettings.show_grievance_section !== false },
      { label: 'Transparency', enabled: rightsCenterSettings.show_transparency_section === true },
      { label: 'DPO', enabled: rightsCenterSettings.show_dpo_section === true },
    ];
    return tabConfig.filter((t) => t.enabled).map((t) => t.label);
  }, [rightsCenterSettings]);

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab(tabs[0] || 'Consent');
    }
  }, [tabs, activeTab]);
  
  // Consent state
  const [consents, setConsents] = useState<FlatPurpose[]>([]);
  const [initialConsents, setInitialConsents] = useState<Record<string, string>>({});
  const [consentsLoading, setConsentsLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [changedPurposeIds, setChangedPurposeIds] = useState<Set<string>>(new Set());
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Legacy compat (used by old ConsentTab rendering path)
  const [consentGroups, setConsentGroups] = useState<ConsentGroup[]>([]);
  const [initialConsentGroups, setInitialConsentGroups] = useState<ConsentGroup[]>([]);
  
  // Rights state
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessConfirmed, setAccessConfirmed] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  
  // DPO state
  const [dpoInfo, setDpoInfo] = useState<DPOInfo | null>(null);
  const [dpoLoading, setDpoLoading] = useState(true);
  const [dpoError, setDpoError] = useState<string | null>(null);
  
  // Nominee state
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [nomineeLoading, setNomineeLoading] = useState(true);
  const [nomineeError, setNomineeError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nomineeForm, setNomineeForm] = useState({
    nominee_name: '',
    relationship: '',
    nominee_email: '',
    nominee_mobile: '',
    purpose_of_appointment: '',
  });
  
  // Grievance state
  const [tickets, setTickets] = useState<GrievanceTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [showGrievanceForm, setShowGrievanceForm] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [grievanceForm, setGrievanceForm] = useState({
    subject: '',
    category: '',
    description: '',
  });
  
  // Nominee dropdown state
  const [showRelationshipDropdown, setShowRelationshipDropdown] = useState(false);

  // ─── Grievance chat ───────────────────────────────────────────────────────────
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<GrievanceMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLive, setChatLive] = useState(false);
  const chatSocketRef = React.useRef<WebSocket | null>(null);
  const chatPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const chatScrollRef = React.useRef<ScrollView | null>(null);

  const scrollChatToBottom = () => {
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const stopChatRealtime = () => {
    chatSocketRef.current?.close();
    chatSocketRef.current = null;
    if (chatPollRef.current) {
      clearInterval(chatPollRef.current);
      chatPollRef.current = null;
    }
  };

  const fetchChatMessages = async (ticketId: string) => {
    try {
      const messages = await api.getGrievanceMessages(ticketId);
      setChatMessages(messages);
      scrollChatToBottom();
    } catch (e) {
      console.warn('[NativeRightCenter] fetchChatMessages error:', e);
    } finally {
      setChatLoading(false);
    }
  };

  const startChatPolling = (ticketId: string) => {
    setChatLive(false);
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    chatPollRef.current = setInterval(() => fetchChatMessages(ticketId), 5000);
  };

  /** Connects to the live chat WebSocket for real-time updates. Falls back to
   * 5s polling if the socket errors, closes, or never opens — mirrors the NPM
   * SDK's `RightCenter.jsx` chat behavior. React Native's global `WebSocket`
   * (unlike browsers) can be used here with the same query-param auth shape
   * as the NPM SDK, for parity with the backend's expected auth. */
  const connectChatRealtime = (ticketId: string) => {
    try {
      const uri = api.grievanceWebSocketUri(ticketId);
      const socket = new WebSocket(uri);
      chatSocketRef.current = socket;
      socket.onopen = () => setChatLive(true);
      socket.onmessage = (event) => {
        try {
          const decoded = JSON.parse(event.data);
          const message: GrievanceMessage = {
            id: String(decoded.id ?? decoded.message_id ?? Date.now()),
            sender: decoded.sender || 'system',
            message: decoded.message || '',
            created_at: decoded.created_at,
          };
          setChatMessages((prev) =>
            prev.some((m) => m.id === message.id) ? prev : [...prev, message]
          );
          scrollChatToBottom();
        } catch (e) {
          console.warn('[NativeRightCenter] chat WS message parse error:', e);
        }
      };
      socket.onerror = () => {
        console.warn('[NativeRightCenter] chat WS error, falling back to polling');
        startChatPolling(ticketId);
      };
      socket.onclose = () => {
        if (openTicketId === ticketId) startChatPolling(ticketId);
      };
    } catch (e) {
      console.warn('[NativeRightCenter] chat WS connect failed, falling back to polling:', e);
      startChatPolling(ticketId);
    }
  };

  const openTicket = (ticket: GrievanceTicket) => {
    const ticketId = (ticket as any).ticket_id || ticket.id;
    if (!ticketId) return;
    setOpenTicketId(ticketId);
    setChatMessages([]);
    setChatLoading(true);
    setChatLive(false);
    fetchChatMessages(ticketId);
    connectChatRealtime(ticketId);
  };

  const closeTicketThread = () => {
    stopChatRealtime();
    setOpenTicketId(null);
    setChatMessages([]);
    setChatLive(false);
  };

  const sendChatMessage = async () => {
    const ticketId = openTicketId;
    const text = chatInput.trim();
    if (!ticketId || !text || chatSending) return;
    setChatSending(true);
    try {
      const sent = await api.sendGrievanceMessage(ticketId, text);
      setChatMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setChatInput('');
      scrollChatToBottom();
    } catch (e) {
      console.warn('[NativeRightCenter] sendChatMessage error:', e);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    return () => stopChatRealtime();
  }, []);

  // Fetch consents using new FlatPurpose-based API
  const fetchUserConsents = async () => {
    setConsentsLoading(true);
    try {
      const data = await api.fetchUserConsents(effectiveUserId, assetId).catch((err) => {
        console.warn('[NativeRightCenter] fetchUserConsents failed, falling back to getUserConsents:', err);
        return null;
      });

      if (data !== null) {
        setConsents(data);
        const map: Record<string, string> = {};
        data.forEach((p) => { map[p.id] = p.consented; });
        setInitialConsents(map);
      } else {
        // Fallback: use old getUserConsents and adapt to flat list
        const groups = await api.getUserConsents(effectiveUserId, assetId).catch(() => []);
        const flat: FlatPurpose[] = groups.flatMap((cp) =>
          (cp.purposes || []).map((p) => ({
            id: p.id,
            name: p.name,
            title: p.name,
            description: p.description,
            expiry_period: p.expiry_period,
            is_mandatory: p.is_mandatory,
            consented: p.consented === 'accepted' ? ('accepted' as const) : ('declined' as const),
            isLegitimate: false,
            dataElements: (cp.data_elements || []) as any[],
            processingActivities: [],
            type: (p.is_mandatory ? 'Mandatory' : 'Optional') as 'Mandatory' | 'Optional',
            timestamp: 0,
          }))
        );
        setConsents(flat);
        const map: Record<string, string> = {};
        flat.forEach((p) => { map[p.id] = p.consented; });
        setInitialConsents(map);
        // Keep legacy state in sync for old ConsentTab
        setConsentGroups(groups);
        setInitialConsentGroups(JSON.parse(JSON.stringify(groups)));
      }
    } catch (error: any) {
      console.error('[NativeRightCenter] Error fetching consents:', error);
      setConsents([]);
      setInitialConsents({});
    } finally {
      setConsentsLoading(false);
    }
  };

  // Fetch DPO
  const fetchDPO = async () => {
    setDpoLoading(true);
    setDpoError(null);
    try {
      const info = await api.getDPOInfo().catch((err) => {
        console.warn('[NativeRightCenter] Error fetching DPO, using null:', err);
        return null;
      });
      setDpoInfo(info);
    } catch (error: any) {
      console.error('[NativeRightCenter] Error fetching DPO:', error);
      setDpoError('Failed to load DPO information');
      setDpoInfo(null);
    } finally {
      setDpoLoading(false);
    }
  };

  // Fetch nominees
  const fetchNominees = async () => {
    setNomineeLoading(true);
    setNomineeError(null);
    try {
      const data = await api.getNominees(effectiveUserId).catch((err) => {
        console.warn('[NativeRightCenter] Error fetching nominees, using empty array:', err);
        return [];
      });
      setNominees(data);
      if (data.length > 0) {
        const n = data[0];
        setNomineeForm({
          nominee_name: n.nominee_name || '',
          relationship: n.relationship || '',
          nominee_email: n.nominee_email || '',
          nominee_mobile: n.nominee_mobile || '',
          purpose_of_appointment: n.purpose_of_appointment || '',
        });
      }
    } catch (error: any) {
      console.error('[NativeRightCenter] Error fetching nominees:', error);
      setNomineeError('Failed to load nominee information');
      setNominees([]);
    } finally {
      setNomineeLoading(false);
    }
  };

  // Fetch grievances
  const fetchGrievances = async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const data = await api.getGrievanceTickets(effectiveUserId).catch((err) => {
        console.warn('[NativeRightCenter] Error fetching grievances, using empty array:', err);
        return [];
      });
      setTickets(data);
    } catch (error: any) {
      console.error('[NativeRightCenter] Error fetching grievances:', error);
      setTicketsError('Failed to load grievance tickets');
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchRightsCenterSettings = async () => {
    try {
      const settings = await api.getRightsCenterSettings(assetId).catch(() => null);
      if (!settings) return null;
      let merged: any;
      setRightsCenterSettings((prev: any) => {
        merged = { ...prev, ...settings };
        return merged;
      });
      return merged ?? settings;
    } catch (err) {
      console.warn('[NativeRightCenter] Failed to fetch rights center settings:', err);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsInitializing(true);
      // Settings must be fetched first: they determine whether non-SSO OTP
      // auth is required before any other (user-scoped) data can be fetched.
      const settings = await fetchRightsCenterSettings();
      const stillNeedsAuth =
        !userId && settings?.access_mode === 'non_sso' && !internalAuth;
      if (stillNeedsAuth) {
        if (!cancelled) setIsInitializing(false);
        return;
      }
      const stillNoIdentity = !userId && !internalAuth;
      const fetches = [fetchDPO()];
      // User-scoped endpoints; skip them entirely when no identity has been
      // resolved (SSO mode, signed-out visitor) rather than firing requests
      // that can only fail.
      if (!stillNoIdentity) {
        fetches.push(fetchUserConsents(), fetchNominees(), fetchGrievances());
      }
      await Promise.allSettled(fetches);
      if (!cancelled) setIsInitializing(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, assetId, internalAuth]);

  // Consent handlers
  const handleToggle = (purposeId: string) => {
    setConsents((prev) =>
      prev.map((p) =>
        p.id === purposeId
          ? { ...p, consented: p.consented === 'accepted' ? 'declined' : 'accepted' }
          : p
      )
    );
    setChangedPurposeIds((prev) => {
      const next = new Set(prev);
      // If toggling back to initial state, remove from changed set
      const currentPurpose = consents.find((p) => p.id === purposeId);
      if (currentPurpose) {
        const newConsented = currentPurpose.consented === 'accepted' ? 'declined' : 'accepted';
        if (newConsented === initialConsents[purposeId]) {
          next.delete(purposeId);
        } else {
          next.add(purposeId);
        }
      } else {
        next.add(purposeId);
      }
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      const changedPurposes = consents
        .filter((c) => changedPurposeIds.has(c.id))
        .map((c) => ({ id: c.id, name: c.name, consented: c.consented as 'accepted' | 'declined' }));

      if (changedPurposes.length === 0) {
        setDirty(false);
        return;
      }

      await api.saveConsentFromRightsCenter(effectiveUserId, changedPurposes, assetId, sessionId);

      setDirty(false);
      setChangedPurposeIds(new Set());
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);

      // Re-fetch to get server-confirmed state
      const fresh = await api.fetchUserConsents(effectiveUserId, assetId).catch(() => null);
      if (fresh) {
        setConsents(fresh);
        const map: Record<string, string> = {};
        fresh.forEach((p) => { map[p.id] = p.consented; });
        setInitialConsents(map);
      }
    } catch (error: any) {
      console.error('[NativeRightCenter] Error saving consents:', error);
      Alert.alert('Error', 'Failed to save consent changes. Please try again.');
    }
  };

  // Nominee handlers
  const handleNomineeSubmit = async (e?: any) => {
    if (e) e.preventDefault();
    const nominee = nominees[0];
    const payload: Nominee = {
      user_id: effectiveUserId,
      client_user_id: effectiveUserId,
      ...nomineeForm,
    };

    try {
      if (nominee && editing && nominee.id) {
        const updated = await api.updateNominee(nominee.id, payload);
        setNominees([updated]);
      } else {
        const created = await api.createNominee(payload);
        setNominees([created]);
      }

      // Backend may return only success object; refresh to keep local state fully populated.
      fetchNominees().catch(() => null);
      setEditing(false);
      Alert.alert('Success', 'Nominee saved successfully');
    } catch (error: any) {
      console.error('[NativeRightCenter] Error saving nominee:', error);
      Alert.alert('Error', 'Failed to save nominee. Please try again.');
    }
  };

  const handleDeleteNominee = async () => {
    const nominee = nominees[0];
    if (!nominee?.id) return;

    Alert.alert(
      'Delete Nominee',
      'Are you sure you want to delete this nominee?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteNominee(nominee.id!);
              setNominees([]);
              setNomineeForm({
                nominee_name: '',
                relationship: '',
                nominee_email: '',
                nominee_mobile: '',
                purpose_of_appointment: '',
              });
              Alert.alert('Success', 'Nominee deleted successfully');
            } catch (error: any) {
              console.error('[NativeRightCenter] Error deleting nominee:', error);
              Alert.alert('Error', 'Failed to delete nominee. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Grievance handlers
  const handleGrievanceSubmit = async (e?: any) => {
    if (e) e.preventDefault();
    const payload: GrievanceTicket = {
      client_user_id: effectiveUserId,
      subject: grievanceForm.subject,
      category: grievanceForm.category,
      description: grievanceForm.description,
    };

    try {
      const created = await api.createGrievanceTicket(payload);
      setTickets((prev) => [created, ...prev]);

      // Keep server state and local list synchronized after create.
      fetchGrievances().catch(() => null);
      setShowGrievanceForm(false);
      setGrievanceForm({ subject: '', category: '', description: '' });
      Alert.alert('Success', 'Grievance ticket created successfully');
    } catch (error: any) {
      console.error('[NativeRightCenter] Error creating grievance:', error);
      Alert.alert('Error', 'Failed to create grievance ticket. Please try again.');
    }
  };

  // Rights request handlers (web parity)
  const handleAccessRequest = async () => {
    try {
      await api.createAccessRequest(effectiveUserId, assetId);
      setAccessConfirmed(true);
      setTimeout(() => {
        setShowAccessModal(false);
        setAccessConfirmed(false);
      }, 1500);
    } catch (error: any) {
      console.error('[NativeRightCenter] Error creating access request:', error);
      Alert.alert('Error', 'Failed to submit access request. Please try again.');
    }
  };

  const handleDeleteRequest = async () => {
    try {
      await api.createDeletionRequest(effectiveUserId, assetId);
      setDeleteConfirmed(true);
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeleteConfirmed(false);
      }, 1500);
    } catch (error: any) {
      console.error('[NativeRightCenter] Error creating deletion request:', error);
      Alert.alert('Error', 'Failed to submit deletion request. Please try again.');
    }
  };

  const nominee = nominees[0] || null;

  if (isInitializing) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading Rights Center...</Text>
      </View>
    );
  }

  if (showOtpGate) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={otpStyles.container}>
          <View style={otpStyles.titleRow}>
            <Text style={[otpStyles.title, { color: theme.textPrimary, flex: 1 }]}>
              Verify your phone number
            </Text>
            <TouchableOpacity
              onPress={() => setNonSsoDismissed(true)}
              accessibilityLabel="Close"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={[otpStyles.subtitle, { color: theme.textSecondary }]}>
            {otpSent
              ? `Enter the OTP sent to ${countryCode}${phone}`
              : 'We need to verify your identity before showing your data rights.'}
          </Text>
          {!otpSent ? (
            <>
              <View style={otpStyles.row}>
                <TextInput
                  value={countryCode}
                  onChangeText={setCountryCode}
                  keyboardType="phone-pad"
                  style={[otpStyles.codeInput, { borderColor: theme.border }]}
                  placeholder="+91"
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={[otpStyles.phoneInput, { borderColor: theme.border }]}
                  placeholder="Phone number"
                />
              </View>
              {otpError && <Text style={otpStyles.error}>{otpError}</Text>}
              <TouchableOpacity
                style={[otpStyles.button, { backgroundColor: theme.button }]}
                onPress={sendOtp}
                disabled={otpSending}
              >
                {otpSending ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Text style={{ color: theme.buttonText, fontWeight: '600' }}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                style={[otpStyles.otpInput, { borderColor: theme.border }]}
                placeholder="••••••"
              />
              {otpError && <Text style={otpStyles.error}>{otpError}</Text>}
              <TouchableOpacity
                style={[otpStyles.button, { backgroundColor: theme.button }]}
                onPress={verifyOtp}
                disabled={otpVerifying}
              >
                {otpVerifying ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <Text style={{ color: theme.buttonText, fontWeight: '600' }}>Verify</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={resendOtp}
                disabled={otpResendsUsed >= 3 || otpCooldown > 0}
                style={otpStyles.resendButton}
              >
                <Text style={{ color: theme.textSecondary }}>
                  {otpCooldown > 0
                    ? `Resend OTP in ${otpCooldown}s`
                    : otpResendsUsed >= 3
                    ? 'No more resends available'
                    : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (needsSsoLogin) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          { backgroundColor: theme.background },
        ]}
      >
        <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingHorizontal: 24 }}>
          Please log in to view your Rights Center.
        </Text>
      </View>
    );
  }

  if (!effectiveUserId) {
    // Non-SSO configured, but the OTP screen was dismissed without
    // completing verification: nothing to show without an identity.
    // Mirrors the NPM SDK, which leaves this state blank too.
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Tabs Navigation - Wrapped in 2 rows (3+3) */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={styles.tabsRow}>
          {tabs.slice(0, 3).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                {
                  borderColor: theme.textSecondary + '66',
                  borderBottomColor: activeTab === tab ? theme.button : 'transparent',
                  backgroundColor: activeTab === tab ? theme.button : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? theme.buttonText : theme.textPrimary },
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.tabsRow}>
          {tabs.slice(3).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                {
                  borderColor: theme.textSecondary + '66',
                  borderBottomColor: activeTab === tab ? theme.button : 'transparent',
                  backgroundColor: activeTab === tab ? theme.button : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? theme.buttonText : theme.textPrimary },
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Content */}
      <ScrollView style={[styles.content, { backgroundColor: theme.background }]} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'Consent' && (
          <ConsentTab
            theme={theme}
            settings={rightsCenterSettings}
            consents={consents}
            consentsLoading={consentsLoading}
            dirty={dirty}
            showSaveSuccess={showSaveSuccess}
            onToggle={handleToggle}
            onSave={handleSave}
            onInfoClick={setModalData}
            readOnly={isNonSsoReadOnly}
          />
        )}

        {activeTab === 'Rights' && (
          <RightsTab
            theme={theme}
            settings={rightsCenterSettings}
            showAccessModal={showAccessModal}
            accessConfirmed={accessConfirmed}
            onAccessRequest={handleAccessRequest}
            onOpenAccessModal={() => {
              setAccessConfirmed(false);
              setShowAccessModal(true);
            }}
            onCloseAccessModal={() => {
              setAccessConfirmed(false);
              setShowAccessModal(false);
            }}
            showDeleteModal={showDeleteModal}
            deleteConfirmed={deleteConfirmed}
            onDeleteRequest={handleDeleteRequest}
            onCloseDeleteModal={() => {
              setDeleteConfirmed(false);
              setShowDeleteModal(false);
            }}
            onOpenDeleteModal={() => {
              setDeleteConfirmed(false);
              setShowDeleteModal(true);
            }}
          />
        )}

        {activeTab === 'Transparency' && (
          <TransparencyTab
            theme={theme}
            description={
              rightsCenterSettings.transparency_description ||
              "We collect your data to provide better services and comply with regulations. Your data is stored securely and used only for the purposes you've consented to."
            }
          />
        )}

        {activeTab === 'DPO' && (
          <DPOTab
            theme={theme}
            settings={rightsCenterSettings}
            dpoInfo={dpoInfo}
            loading={dpoLoading}
            error={dpoError}
          />
        )}

        {activeTab === 'Nominee' && (
          <NomineeTab
            theme={theme}
            settings={rightsCenterSettings}
            nominee={nominee}
            editing={editing}
            nomineeForm={nomineeForm}
            loading={nomineeLoading}
            error={nomineeError}
            onFormChange={setNomineeForm}
            onSubmit={handleNomineeSubmit}
            onEdit={() => setEditing(true)}
            onCancel={() => setEditing(false)}
            onDelete={handleDeleteNominee}
            showRelationshipDropdown={showRelationshipDropdown}
            onToggleRelationshipDropdown={() => setShowRelationshipDropdown(!showRelationshipDropdown)}
          />
        )}

        {activeTab === 'Grievance' && (
          openTicketId ? (
            <GrievanceThread
              theme={theme}
              ticket={tickets.find((t) => ((t as any).ticket_id || t.id) === openTicketId) || null}
              messages={chatMessages}
              loading={chatLoading}
              sending={chatSending}
              live={chatLive}
              input={chatInput}
              onInputChange={setChatInput}
              onSend={sendChatMessage}
              onClose={closeTicketThread}
              scrollRef={chatScrollRef}
            />
          ) : rightsCenterSettings.grievance_mode === 'external' ? (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Grievance</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Submit grievances via your organization portal.
              </Text>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.button },
                  !rightsCenterSettings.grievance_external_url ? { opacity: 0.6 } : null,
                ]}
                disabled={!rightsCenterSettings.grievance_external_url}
                onPress={() => {
                  if (rightsCenterSettings.grievance_external_url) {
                    Linking.openURL(rightsCenterSettings.grievance_external_url);
                  }
                }}
              >
                <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Open Grievance Portal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <GrievanceTab
              theme={theme}
              tickets={tickets}
              loading={ticketsLoading}
              error={ticketsError}
              showForm={showGrievanceForm}
              form={grievanceForm}
              onFormChange={setGrievanceForm}
              onSubmit={handleGrievanceSubmit}
              onToggleForm={() => setShowGrievanceForm(!showGrievanceForm)}
              showCategoryDropdown={showCategoryDropdown}
              onToggleCategoryDropdown={() => setShowCategoryDropdown(!showCategoryDropdown)}
              onOpenTicket={openTicket}
            />
          )
        )}
      </ScrollView>

      {/* Save Success Modal */}
      <Modal visible={showSaveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Changes Saved</Text>
            <Text style={styles.modalSubtitle}>Your consent preferences have been updated.</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSaveModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Consent Detail Modal */}
      {modalData && (
        <Modal visible={!!modalData} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{modalData.title}</Text>
                <TouchableOpacity onPress={() => setModalData(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                <Text style={styles.modalSubtitle}>{modalData.description}</Text>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Expiry:</Text>
                  <Text style={styles.modalFieldValue}>{modalData.expiry}</Text>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Collection Point:</Text>
                  <Text style={styles.modalFieldValue}>{modalData.collectionPoint}</Text>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Type:</Text>
                  <Text style={[styles.badge, modalData.type === 'Mandatory' && styles.badgeMandatory]}>
                    {modalData.type}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// Reusable Select Dropdown Component
interface SelectDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  theme?: any;
}

function SelectDropdown({ label, placeholder, value, options, onSelect, visible, onToggle, theme }: SelectDropdownProps) {
  const currentTheme = theme || {
    background: '#ffffff',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    button: '#9333ea',
    hoverBg: '#f3e8ff',
  };

  return (
    <View style={styles.selectContainer}>
      <Text style={[styles.selectLabel, { color: currentTheme.textPrimary }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectInput, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}
        onPress={onToggle}
      >
        <Text
          style={[
            styles.selectInputText,
            { color: currentTheme.textPrimary },
            !value && [styles.selectInputPlaceholder, { color: currentTheme.textSecondary }],
          ]}
        >
          {value || placeholder}
        </Text>
        <Text style={[styles.selectArrow, { color: currentTheme.textSecondary }]}>▼</Text>
      </TouchableOpacity>
      
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onToggle}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={onToggle}
        >
          <View style={[styles.dropdownContainer, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}> 
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownOption,
                  { borderBottomColor: currentTheme.border },
                  value === option.value && [styles.dropdownOptionSelected, { backgroundColor: currentTheme.hoverBg }],
                  index === options.length - 1 && styles.dropdownOptionLast,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onToggle();
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    { color: currentTheme.textPrimary },
                    value === option.value && [styles.dropdownOptionTextSelected, { color: currentTheme.button }],
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Tab Components
function ConsentTab({
  theme,
  settings,
  consents,
  consentsLoading,
  dirty,
  showSaveSuccess,
  onToggle,
  onSave,
  onInfoClick,
  readOnly,
}: any) {
  if (consentsLoading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading consents...</Text>
      </View>
    );
  }

  // Non-SSO: only show purposes with a genuine logged decision
  // (timestamp > 0), split into "Mandatory Processing" (no consent
  // required) and everything else — mirrors the NPM SDK's RightCenter.jsx.
  const visibleConsents: FlatPurpose[] = readOnly
    ? (consents as FlatPurpose[]).filter((p) => (p.timestamp ?? 0) > 0)
    : consents;
  const mandatoryLogged = readOnly ? visibleConsents.filter((p) => p.is_mandatory) : [];
  const otherLogged = readOnly ? visibleConsents.filter((p) => !p.is_mandatory) : visibleConsents;

  const getDataElementsText = (p: FlatPurpose) => {
    const elements = Array.isArray(p.dataElements) ? p.dataElements : [];
    return elements
      .map((el: any) =>
        typeof el === 'string' || typeof el === 'number'
          ? String(el)
          : el?.name || el?.label || el?.title || el?.id
      )
      .filter(Boolean)
      .join(', ') || 'Not specified';
  };

  const getProcessingText = (p: FlatPurpose) => {
    const acts = Array.isArray(p.processingActivities) ? p.processingActivities : [];
    if (acts.length === 0) return 'Not specified';
    return acts
      .map((a: any) => (typeof a === 'string' ? a : a?.name || a?.title || String(a)))
      .filter(Boolean)
      .join(', ');
  };

  const renderCard = (p: FlatPurpose) => (
    <View key={p.id} style={[styles.purposeCard, { borderColor: theme.border }]}>
      {/* Header Row: Purpose name, badge, legitimate badge, and toggle */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.purposeHeaderLeft}>
          <Text style={[styles.purposeTitle, { color: theme.textPrimary }]}>{p.name}</Text>
          <Text
            style={[
              styles.badge,
              p.is_mandatory ? styles.badgeMandatory : styles.badgeOptional,
            ]}
          >
            {p.is_mandatory ? 'Necessary' : 'Optional'}
          </Text>
          {p.isLegitimate && (
            <Text style={styles.badgeLegitimate}>Legitimate Interest</Text>
          )}
        </View>
        {!readOnly && (
          <View style={styles.toggleSection}>
            <Switch
              value={p.consented === 'accepted'}
              onValueChange={() => !p.isLegitimate && onToggle(p.id)}
              disabled={p.isLegitimate}
              trackColor={{ false: '#ccc', true: theme.button }}
            />
          </View>
        )}
      </View>

      {/* Expiry Period */}
      <View style={styles.metaRow}>
        <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Expiry:</Text>
        <Text style={[styles.metaValue, { color: theme.textPrimary }]}>
          {p.expiry_period || 'Not specified'}
        </Text>
      </View>

      {/* Processing Activity */}
      <View style={styles.metaRow}>
        <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Processing:</Text>
        <Text style={[styles.metaValue, { color: theme.textPrimary }]}>
          {getProcessingText(p)}
        </Text>
      </View>

      {/* Consented Status pill */}
      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Consented:</Text>
          <Text
            style={[
              styles.statusValue,
              p.consented === 'accepted'
                ? { backgroundColor: theme.button, color: theme.buttonText }
                : { backgroundColor: '#ef4444', color: '#ffffff' },
            ]}
          >
            {p.consented === 'accepted' ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* Data Elements chips */}
      <View style={styles.metaRow}>
        <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Data Elements:</Text>
        <Text style={[styles.metaValue, { color: theme.textPrimary }]}>
          {getDataElementsText(p)}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            {settings?.consents_section_title || 'Manage your Consents here!'}
          </Text>
        </View>
        {dirty && !readOnly && (
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.button }]} onPress={onSave}>
            <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Changes</Text>
          </TouchableOpacity>
        )}
      </View>

      {showSaveSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>Consent preferences saved successfully!</Text>
        </View>
      )}

      {visibleConsents.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>You currently have no consent records to display.</Text>
        </View>
      ) : (
        <View>
          {otherLogged.map(renderCard)}
          {readOnly && mandatoryLogged.length > 0 && (
            <>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary, marginTop: 8 }]}>
                Mandatory Processing (No Consent Required)
              </Text>
              {mandatoryLogged.map(renderCard)}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function RightsTab({
  theme,
  settings,
  showAccessModal,
  accessConfirmed,
  onAccessRequest,
  onCloseAccessModal,
  onOpenAccessModal,
  showDeleteModal,
  deleteConfirmed,
  onDeleteRequest,
  onCloseDeleteModal,
  onOpenDeleteModal,
}: any) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        {settings?.rights_section_title || 'Your Data Rights'}
      </Text>
      <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Request access to your data or request deletion.</Text>

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.button }]} onPress={onOpenAccessModal}>
        <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Request Data Access</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.button }]} onPress={onOpenDeleteModal}>
        <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Request Data Deletion</Text>
      </TouchableOpacity>

      <Modal visible={showAccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!accessConfirmed ? (
              <>
                <Text style={styles.modalTitle}>Confirm Data Access Request</Text>
                <Text style={styles.modalSubtitle}>
                  Are you sure you want to request access to your personal data?
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.primaryButton} onPress={onAccessRequest}>
                    <Text style={styles.primaryButtonText}>Confirm Access</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={onCloseAccessModal}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Request Submitted</Text>
                <Text style={styles.modalSubtitle}>
                  Your data access request has been submitted successfully!
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!deleteConfirmed ? (
              <>
                <Text style={styles.modalTitle}>Confirm Data Deletion</Text>
                <Text style={styles.modalSubtitle}>
                  Are you sure you want to request data deletion? This action cannot be undone.
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.dangerButton} onPress={onDeleteRequest}>
                    <Text style={styles.dangerButtonText}>Confirm Deletion</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={onCloseDeleteModal}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Request Submitted</Text>
                <Text style={styles.modalSubtitle}>
                  Your data deletion request has been submitted successfully!
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TransparencyTab({ theme, description }: { theme: any; description: string }) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Transparency</Text>
      <Text style={[styles.transparencyText, { color: theme.textSecondary }]}>{description}</Text>
    </View>
  );
}

function DPOTab({ theme, settings, dpoInfo, loading, error }: any) {
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading DPO information...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>DPO Information</Text>
      {dpoInfo && (
        <View style={[styles.dpoCard, { backgroundColor: theme.background, borderColor: theme.border }]}> 
          <View style={styles.dpoItem}>
            <Text style={[styles.dpoLabel, { color: theme.textPrimary }]}>Full Name</Text>
            <Text style={[styles.dpoValue, { color: theme.textSecondary }]}>{dpoInfo.full_name || 'Not available'}</Text>
          </View>
          <View style={styles.dpoItem}>
            <Text style={[styles.dpoLabel, { color: theme.textPrimary }]}>Email</Text>
            <Text style={[styles.dpoValue, { color: theme.textSecondary }]}>{dpoInfo.email || 'Not available'}</Text>
          </View>
          <View style={styles.dpoItem}>
            <Text style={[styles.dpoLabel, { color: theme.textPrimary }]}>Appointment Date</Text>
            <Text style={[styles.dpoValue, { color: theme.textSecondary }]}>{dpoInfo.appointment_date || 'Not available'}</Text>
          </View>
          {settings?.dpo_qualifications_enabled && (
            <View style={styles.dpoItem}>
              <Text style={[styles.dpoLabel, { color: theme.textPrimary }]}>Qualifications</Text>
              <Text style={[styles.dpoValue, { color: theme.textSecondary }]}>{dpoInfo.qualifications || 'Not available'}</Text>
            </View>
          )}
          {settings?.dpo_responsibilities_enabled && (
            <View style={styles.dpoItem}>
              <Text style={[styles.dpoLabel, { color: theme.textPrimary }]}>Responsibilities</Text>
              <Text style={[styles.dpoValue, { color: theme.textSecondary }]}>{dpoInfo.responsibilities || 'Not available'}</Text>
            </View>
          )}
          {settings?.dpo_working_hours_enabled && (
            <View style={styles.dpoItem}>
              <Text style={[styles.dpoLabel, { color: theme.textPrimary }]}>Working Hours</Text>
              <Text style={[styles.dpoValue, { color: theme.textSecondary }]}>{dpoInfo.working_hours || 'Not available'}</Text>
            </View>
          )}
          {settings?.dpo_response_time_enabled && (
            <View style={styles.dpoItem}>
              <Text style={[styles.dpoLabel, { color: theme.textPrimary }]}>Response Time</Text>
              <Text style={[styles.dpoValue, { color: theme.textSecondary }]}>{dpoInfo.response_time || 'Not available'}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function NomineeTab({ theme, settings, nominee, editing, nomineeForm, loading, error, onFormChange, onSubmit, onEdit, onCancel, onDelete, showRelationshipDropdown, onToggleRelationshipDropdown }: any) {
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading nominee information...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{settings?.nominees_section_title || 'Appoint Nominee'}</Text>
      <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Appoint someone to manage your data rights on your behalf</Text>
      
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠️ Your nominee will be able to exercise all data rights on your behalf.
        </Text>
      </View>

      {nominee && !editing ? (
        <View style={styles.nomineeCard}>
          <View style={styles.nomineeItem}>
            <Text style={styles.nomineeLabel}>Name</Text>
            <Text style={styles.nomineeValue}>{nominee.nominee_name}</Text>
          </View>
          <View style={styles.nomineeItem}>
            <Text style={styles.nomineeLabel}>Relationship</Text>
            <Text style={styles.nomineeValue}>{nominee.relationship}</Text>
          </View>
          <View style={styles.nomineeItem}>
            <Text style={styles.nomineeLabel}>Email</Text>
            <Text style={styles.nomineeValue}>{nominee.nominee_email}</Text>
          </View>
          <View style={styles.nomineeItem}>
            <Text style={styles.nomineeLabel}>Mobile</Text>
            <Text style={styles.nomineeValue}>{nominee.nominee_mobile}</Text>
          </View>
          {nominee.purpose_of_appointment && (
            <View style={styles.nomineeItem}>
              <Text style={styles.nomineeLabel}>Purpose of Appointment</Text>
              <Text style={styles.nomineeValue}>{nominee.purpose_of_appointment}</Text>
            </View>
          )}
          <View style={styles.nomineeActions}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.button }]}
              onPress={onEdit}
            >
              <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={onDelete}>
              <Text style={styles.dangerButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full name of nominee *"
            value={nomineeForm.nominee_name}
            onChangeText={(text) => onFormChange({ ...nomineeForm, nominee_name: text })}
          />
          <SelectDropdown
            label="Relationship *"
            placeholder="Select relationship"
            value={nomineeForm.relationship}
            options={[
              { label: 'Spouse', value: 'Spouse' },
              { label: 'Parent', value: 'Parent' },
              { label: 'Child', value: 'Child' },
              { label: 'Sibling', value: 'Sibling' },
              { label: 'Other', value: 'Other' },
            ]}
            onSelect={(value) => onFormChange({ ...nomineeForm, relationship: value })}
            visible={showRelationshipDropdown}
            onToggle={onToggleRelationshipDropdown}
            theme={theme}
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            keyboardType="email-address"
            value={nomineeForm.nominee_email}
            onChangeText={(text) => onFormChange({ ...nomineeForm, nominee_email: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Mobile Number *"
            keyboardType="phone-pad"
            value={nomineeForm.nominee_mobile}
            onChangeText={(text) => onFormChange({ ...nomineeForm, nominee_mobile: text })}
          />
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Purpose of Appointment"
            multiline
            numberOfLines={4}
            value={nomineeForm.purpose_of_appointment}
            onChangeText={(text) => onFormChange({ ...nomineeForm, purpose_of_appointment: text })}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onSubmit}>
              <Text style={styles.primaryButtonText}>
                {editing ? 'Update Nominee' : 'Send Verification Code'}
              </Text>
            </TouchableOpacity>
            {editing && (
              <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function GrievanceThread({
  theme,
  ticket,
  messages,
  loading,
  sending,
  live,
  input,
  onInputChange,
  onSend,
  onClose,
  scrollRef,
}: any) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[chatStyles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} style={chatStyles.backButton}>
          <Text style={{ fontSize: 18, color: theme.textPrimary }}>{'←'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[chatStyles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {ticket?.subject || 'Ticket'}
          </Text>
          <Text style={{ fontSize: 11, color: live ? '#059669' : theme.textSecondary }}>
            {live ? 'Live' : 'Updates every 5s'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={{ color: theme.textSecondary }}>No messages yet. Say hello!</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {messages.map((m: GrievanceMessage) => (
            <View
              key={m.id}
              style={[
                chatStyles.bubble,
                m.sender === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: theme.button }
                  : { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
              ]}
            >
              <Text style={{ color: m.sender === 'user' ? theme.buttonText : '#111827' }}>
                {m.message}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={[chatStyles.inputRow, { borderTopColor: theme.border }]}>
        <TextInput
          value={input}
          onChangeText={onInputChange}
          placeholder="Type a message…"
          style={[chatStyles.input, { borderColor: theme.border }]}
          multiline
          onSubmitEditing={onSend}
        />
        <TouchableOpacity onPress={onSend} disabled={sending} style={chatStyles.sendButton}>
          {sending ? (
            <ActivityIndicator size="small" color={theme.button} />
          ) : (
            <Text style={{ color: theme.button, fontWeight: '700' }}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const chatStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

function GrievanceTab({ theme, tickets, loading, error, showForm, form, onFormChange, onSubmit, onToggleForm, showCategoryDropdown, onToggleCategoryDropdown, onOpenTicket }: any) {
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading grievance tickets...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Grievance Tickets</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Submit privacy concerns or view your existing tickets</Text>
        </View>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.button }]} onPress={onToggleForm}>
          <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Create New Ticket</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="Subject *"
            placeholderTextColor={theme.textSecondary}
            value={form.subject}
            onChangeText={(text) => onFormChange({ ...form, subject: text })}
          />
          <SelectDropdown
            label="Category *"
            placeholder="Select category"
            value={form.category}
            options={[
              { label: 'Privacy Concern', value: 'Privacy Concern' },
              { label: 'Data Access', value: 'Data Access' },
              { label: 'Other', value: 'Other' },
            ]}
            onSelect={(value) => onFormChange({ ...form, category: value })}
            visible={showCategoryDropdown}
            onToggle={onToggleCategoryDropdown}
            theme={theme}
          />
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="Description *"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            value={form.description}
            onChangeText={(text) => onFormChange({ ...form, description: text })}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onSubmit}>
              <Text style={styles.primaryButtonText}>Submit Ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onToggleForm}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.ticketsSection}>
        <Text style={[styles.ticketsTitle, { color: theme.textPrimary }]}>Your Tickets</Text>
        {tickets.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tickets found. Create your first grievance ticket above.</Text>
          </View>
        ) : (
          tickets.map((ticket: GrievanceTicket, index: number) => {
            const ticketRef = (ticket as any).ticket_id || ticket.id;

            return (
              <TouchableOpacity
                key={index}
                style={[styles.ticketCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => onOpenTicket?.(ticket)}
              >
                <View style={styles.ticketHeader}>
                  <Text style={[styles.ticketSubject, { color: theme.textPrimary }]}>{ticket.subject}</Text>
                  <Text style={[styles.ticketStatus, { backgroundColor: theme.successBg, color: theme.successText }]}>
                    {(ticket.status || 'Open').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.ticketDescription, { color: theme.textSecondary }]}>{ticket.description}</Text>
                <View style={styles.ticketMetaRow}>
                  {!!ticketRef && (
                    <Text style={[styles.ticketMetaItem, { color: theme.textPrimary }]}>Ticket: {ticketRef}</Text>
                  )}
                  {!!ticket.category && (
                    <Text style={[styles.ticketMetaItem, { color: theme.textPrimary }]}>Category: {ticket.category}</Text>
                  )}
                </View>
                <Text style={[styles.ticketMetaItem, { color: theme.textSecondary, marginTop: 6 }]}>
                  {'\u{1F4AC} View conversation'}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}

const otpStyles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'stretch',
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  codeInput: {
    width: 72,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginRight: 12,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
  otpInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  resendButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  error: {
    color: 'red',
    fontSize: 12,
    marginBottom: 8,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  principalBanner: {
    backgroundColor: '#e0e7ff',
    padding: 12,
    alignItems: 'center',
  },
  principalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  tabsContainer: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginHorizontal: 2,
  },
  tabActive: {
    borderBottomColor: '#9333ea',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  tabContent: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitleContainer: {
    flex: 1,
    minWidth: 200,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  consentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  consentCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  purposeCard: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  purposeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  purposeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  purposeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIcon: {
    fontSize: 18,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeMandatory: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  purposeDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  purposeDetails: {
    marginBottom: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  purposeStatus: {
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  toggleContainer: {
    alignItems: 'flex-start',
  },
  saveButton: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 16,
  },
  dangerButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 140,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#1e293b',
    fontWeight: '600',
    textAlign: 'center',
  },
  transparencyText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  dpoCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  dpoItem: {
    marginBottom: 16,
  },
  dpoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  dpoValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
  },
  nomineeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  nomineeItem: {
    marginBottom: 16,
  },
  nomineeLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  nomineeValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  nomineeActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  form: {
    marginTop: 16,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    color: '#1e293b',
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectContainer: {
    marginBottom: 12,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  selectInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  selectInputText: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  selectInputPlaceholder: {
    color: '#94a3b8',
  },
  selectArrow: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 280,
    maxWidth: '90%',
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionSelected: {
    backgroundColor: '#f3e8ff',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1e293b',
  },
  dropdownOptionTextSelected: {
    color: '#9333ea',
    fontWeight: '600',
  },
  formActions: {
    marginTop: 16,
  },
  ticketsSection: {
    marginTop: 24,
  },
  ticketsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  ticketStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ticketDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  ticketMetaItem: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  modalClose: {
    fontSize: 24,
    color: '#64748b',
  },
  modalField: {
    marginBottom: 12,
  },
  modalFieldLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  modalFieldValue: {
    fontSize: 14,
    color: '#1e293b',
  },
  modalButton: {
    backgroundColor: '#9333ea',
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 16,
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  modalActions: {
    marginTop: 16,
  },
  // New styles for improved Consent Tab
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  purposeHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleSection: {
    marginLeft: 12,
  },
  metaRow: {
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  metaValue: {
    fontSize: 12,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  statusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusYes: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusNo: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  badgeOptional: {
    backgroundColor: '#dbeafe',
    color: '#0c4a6e',
  },
  badgeLegitimate: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  successBanner: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  successBannerText: {
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center',
  },
});

