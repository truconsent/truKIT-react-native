/**
 * Unit tests for the banner translation snapshot mechanism, which drives
 * both the dynamic-content translation and the language switcher's
 * available-language list (see truKIT-NPM's TranslationContext.jsx, whose
 * algorithm this mirrors exactly).
 */
import { getAvailableLanguages, createTranslator } from '../src/utils/translationSnapshot';

describe('getAvailableLanguages', () => {
  it('uses snapshot.languages when provided, always including en', () => {
    const { availableLanguages, languageLabels } = getAvailableLanguages({
      languages: [
        { code: 'ta', label: 'Tamil' },
        { code: 'hi', label: 'Hindi' },
      ],
    });
    expect(availableLanguages).toEqual(['en', 'ta', 'hi']);
    expect(languageLabels).toEqual({ ta: 'Tamil', hi: 'Hindi' });
  });

  it('does not duplicate en if snapshot.languages already includes it', () => {
    const { availableLanguages } = getAvailableLanguages({
      languages: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'French' },
      ],
    });
    expect(availableLanguages).toEqual(['en', 'fr']);
  });

  it('derives languages from text_map keys when no languages array is present', () => {
    const { availableLanguages } = getAvailableLanguages({
      text_map: {
        'Some Purpose': { en: 'Some Purpose', ta: 'சில நோக்கம்', hi: 'कुछ उद्देश्य', fr: 'Un but' },
      },
    });
    expect(availableLanguages.sort()).toEqual(['en', 'fr', 'hi', 'ta'].sort());
  });

  it('supports camelCase textMap too', () => {
    const { availableLanguages } = getAvailableLanguages({
      textMap: { Title: { en: 'Title', de: 'Titel' } },
    });
    expect(availableLanguages.sort()).toEqual(['de', 'en']);
  });

  it('returns an empty list when there is no snapshot at all', () => {
    expect(getAvailableLanguages(undefined)).toEqual({ availableLanguages: [], languageLabels: {} });
    expect(getAvailableLanguages(null)).toEqual({ availableLanguages: [], languageLabels: {} });
  });
});

describe('createTranslator', () => {
  const snapshot = {
    text_map: {
      'Marketing Communications': { ta: 'சந்தைப்படுத்தல் தொடர்புகள்', hi: 'विपणन संचार' },
      'This is a very long footer disclaimer string that goes on and on past eighty characters for prefix matching purposes and then has a target=_blank link appended':
        { hi: 'यह एक लंबा फुटर अस्वीकरण पाठ है' },
    },
  };

  it('returns the identity function for English (the source language)', () => {
    const translate = createTranslator(snapshot, 'en');
    expect(translate('Marketing Communications')).toBe('Marketing Communications');
  });

  it('returns the identity function when there is no snapshot', () => {
    const translate = createTranslator(undefined, 'ta');
    expect(translate('Marketing Communications')).toBe('Marketing Communications');
  });

  it('translates an exact match for the requested language', () => {
    const translate = createTranslator(snapshot, 'ta');
    expect(translate('Marketing Communications')).toBe('சந்தைப்படுத்தல் தொடர்புகள்');
  });

  it('falls back to a case-insensitive match', () => {
    const translate = createTranslator(snapshot, 'hi');
    expect(translate('marketing communications')).toBe('विपणन संचार');
  });

  it('falls back to a 60-char-prefix match for long strings', () => {
    const translate = createTranslator(snapshot, 'hi');
    const longText =
      'This is a very long footer disclaimer string that goes on and on past eighty characters for prefix matching purposes and then has a target=_BLANK link appended';
    expect(translate(longText)).toBe('यह एक लंबा फुटर अस्वीकरण पाठ है');
  });

  it('returns the original text when no translation is found', () => {
    const translate = createTranslator(snapshot, 'ta');
    expect(translate('Some Untranslated Purpose')).toBe('Some Untranslated Purpose');
  });

  it('returns an empty string for falsy input', () => {
    const translate = createTranslator(snapshot, 'ta');
    expect(translate('')).toBe('');
  });
});
