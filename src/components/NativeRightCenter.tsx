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
  ConsentPayload,
} from '../services/rightsCenterApi';
import { deriveThemeColors } from '../utils/ColorUtils';
import { DEFAULT_API_URL } from '../core/BannerService';

export interface NativeRightCenterProps {
  userId: string;
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
}: NativeRightCenterProps) {
  const [rightsCenterSettings, setRightsCenterSettings] = useState(
    DEFAULT_RIGHTS_CENTER_SETTINGS as any
  );
  const [isInitializing, setIsInitializing] = useState(true);

  const [activeTab, setActiveTab] = useState('Consent');

  // Single API instance — same key for all calls, same as website
  const [api] = useState(
    () => new RightsCenterApi(apiUrl ?? DEFAULT_API_URL, apiKey, organizationId, userId)
  );

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

  // Fetch consents using new FlatPurpose-based API
  const fetchUserConsents = async () => {
    setConsentsLoading(true);
    try {
      const data = await api.fetchUserConsents(userId, assetId).catch((err) => {
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
        const groups = await api.getUserConsents(userId, assetId).catch(() => []);
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
      const data = await api.getNominees(userId).catch((err) => {
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
      const data = await api.getGrievanceTickets(userId).catch((err) => {
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
      if (!settings) return;
      setRightsCenterSettings((prev: any) => ({
        ...prev,
        ...settings,
      }));
    } catch (err) {
      console.warn('[NativeRightCenter] Failed to fetch rights center settings:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsInitializing(true);
      await Promise.allSettled([
        fetchRightsCenterSettings(),
        fetchUserConsents(),
        fetchDPO(),
        fetchNominees(),
        fetchGrievances(),
      ]);
      if (!cancelled) setIsInitializing(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, assetId]);

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

      await api.saveConsentFromRightsCenter(userId, changedPurposes, assetId, sessionId);

      setDirty(false);
      setChangedPurposeIds(new Set());
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);

      // Re-fetch to get server-confirmed state
      const fresh = await api.fetchUserConsents(userId, assetId).catch(() => null);
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
      user_id: userId,
      client_user_id: userId,
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
      client_user_id: userId,
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
      await api.createAccessRequest(userId, assetId);
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
      await api.createDeletionRequest(userId, assetId);
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
          rightsCenterSettings.grievance_mode === 'external' ? (
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
function ConsentTab({ theme, settings, consents, consentsLoading, dirty, showSaveSuccess, onToggle, onSave, onInfoClick }: any) {
  if (consentsLoading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading consents...</Text>
      </View>
    );
  }

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

  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            {settings?.consents_section_title || 'Manage your Consents here!'}
          </Text>
        </View>
        {dirty && (
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

      {consents.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>You currently have no consent records to display.</Text>
        </View>
      ) : (
        <View>
          {(consents as FlatPurpose[]).map((p) => (
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
                <View style={styles.toggleSection}>
                  <Switch
                    value={p.consented === 'accepted'}
                    onValueChange={() => !p.isLegitimate && onToggle(p.id)}
                    disabled={p.isLegitimate}
                    trackColor={{ false: '#ccc', true: theme.button }}
                  />
                </View>
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
          ))}
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
            <TouchableOpacity style={styles.primaryButton} onPress={onEdit}>
              <Text style={styles.primaryButtonText}>Edit</Text>
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

function GrievanceTab({ theme, tickets, loading, error, showForm, form, onFormChange, onSubmit, onToggleForm, showCategoryDropdown, onToggleCategoryDropdown }: any) {
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
              <View key={index} style={[styles.ticketCard, { backgroundColor: theme.background, borderColor: theme.border }]}> 
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
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

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

