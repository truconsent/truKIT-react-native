/**
 * HCaseWarningModal - Modal shown when user tries to decline mandatory consent purposes
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export interface HCaseWarningModalProps {
  visible: boolean;
  strategy: 'soft_first' | 'hard_immediate';
  message?: string;
  proceedText?: string;
  backText?: string;
  onProceed: () => void;
  onBack: () => void;
  primaryColor?: string;
}

export default function HCaseWarningModal({
  visible,
  strategy,
  message,
  proceedText = 'Proceed Anyway',
  backText = 'Go Back',
  onProceed,
  onBack,
  primaryColor = '#7030bc',
}: HCaseWarningModalProps) {
  const warningMessage =
    message ||
    'Some of the purposes you are declining are required for the service to function properly. Are you sure you want to proceed?';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onBack}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Warning icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.warningIcon}>⚠️</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Consent Required</Text>

          {/* Message */}
          <Text style={styles.message}>{warningMessage}</Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {strategy === 'soft_first' ? (
              <>
                <TouchableOpacity
                  style={[styles.backButton, { borderColor: primaryColor }]}
                  onPress={onBack}
                >
                  <Text style={[styles.backButtonText, { color: primaryColor }]}>{backText}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.proceedButton, { backgroundColor: primaryColor }]}
                  onPress={onProceed}
                >
                  <Text style={styles.proceedButtonText}>{proceedText}</Text>
                </TouchableOpacity>
              </>
            ) : (
              // hard_immediate: only an OK button (no proceed anyway)
              <TouchableOpacity
                style={[styles.okButton, { backgroundColor: primaryColor }]}
                onPress={onBack}
              >
                <Text style={styles.proceedButtonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 12,
  },
  warningIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  backButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  proceedButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  proceedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  okButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    maxWidth: 160,
  },
});
