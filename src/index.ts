/**
 * TruConsent React Native SDK - Main entry point
 */
export { default as TruConsentModal } from './components/TruConsentModal';
export { default as TruConsent } from './components/TruConsent';
export { default as RightCenter } from './components/RightCenter';
export { default as NativeRightCenter } from './components/NativeRightCenter';
export { default as BannerUI } from './components/BannerUI';
export { default as CookieBannerUI } from './components/CookieBannerUI';
export { default as HCaseWarningModal } from './components/HCaseWarningModal';

export * from './core/types';
export * from './core/BannerService';
export * from './core/ConsentManager';
export * from './hooks/useBanner';
export * from './hooks/useConsent';
export * from './utils/RequestIdGenerator';
export * from './utils/ColorUtils';

// Default export
export { default } from './components/TruConsentModal';

