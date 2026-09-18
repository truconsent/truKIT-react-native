/**
 * Snapshot-driven translation for dynamic (server-supplied) banner content —
 * purpose names/descriptions, banner title/disclaimer/footer. This is
 * distinct from the static i18next UI-string bundles (Accept All, etc.):
 * the snapshot translates whatever text the admin actually configured, in
 * whatever languages they configured, rather than a fixed built-in set.
 *
 * Mirrors truKIT-NPM's `src/runtime/TranslationContext.jsx` algorithm
 * exactly (exact match → case-insensitive → 60-char-prefix match for long
 * strings like footer HTML).
 */

export interface TranslationSnapshot {
  text_map?: Record<string, Record<string, string>>;
  textMap?: Record<string, Record<string, string>>;
  // The real API sends `name` (e.g. { code: 'as', name: 'অসমীয়া' }), not
  // `label` — confirmed against the live trukit-dev API response. `label` is
  // kept as a defensive fallback only.
  languages?: { code: string; name?: string; label?: string }[];
}

export interface LanguageInfo {
  availableLanguages: string[];
  languageLabels: Record<string, string>;
}

export function getAvailableLanguages(snapshot?: TranslationSnapshot | null): LanguageInfo {
  if (snapshot?.languages?.length) {
    const labels: Record<string, string> = {};
    snapshot.languages.forEach(({ code, name, label }) => {
      const resolved = name || label;
      if (resolved) labels[code] = resolved;
    });
    const codes = snapshot.languages.map((l) => l.code);
    if (!codes.includes('en')) codes.unshift('en');
    return { availableLanguages: codes, languageLabels: labels };
  }

  const textMap = snapshot?.text_map || snapshot?.textMap;
  if (!textMap) return { availableLanguages: [], languageLabels: {} };

  const firstEntry = Object.values(textMap)[0];
  if (!firstEntry || typeof firstEntry !== 'object') {
    return { availableLanguages: [], languageLabels: {} };
  }
  const snapshotLangs = Object.keys(firstEntry).filter((l) => l !== 'en');
  return { availableLanguages: ['en', ...snapshotLangs], languageLabels: {} };
}

const normalizeLongKey = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/_blank/gi, 'blank').trim().toLowerCase();

/**
 * Builds a `translate(text)` function bound to a specific snapshot/language.
 * Returns the identity function when there's no snapshot or the language is
 * 'en' (the snapshot's source language), matching the NPM SDK.
 */
export function createTranslator(
  snapshot: TranslationSnapshot | null | undefined,
  lang: string
): (text: string) => string {
  const textMap = snapshot?.text_map || snapshot?.textMap;
  if (!lang || lang === 'en' || !textMap) {
    return (text: string) => text || '';
  }

  const lowerCaseMap: Record<string, Record<string, string>> = {};
  Object.entries(textMap).forEach(([key, val]) => {
    lowerCaseMap[key.toLowerCase()] = val;
  });

  const prefixMap: Record<string, Record<string, string>> = {};
  Object.entries(textMap).forEach(([key, val]) => {
    if (key.length > 80) {
      const prefix = normalizeLongKey(key).slice(0, 60);
      if (!prefixMap[prefix]) prefixMap[prefix] = val;
    }
  });

  return (text: string) => {
    if (!text) return '';
    const exact = textMap[text]?.[lang];
    if (exact) return exact;
    const lower = lowerCaseMap[text.toLowerCase()]?.[lang];
    if (lower) return lower;
    if (text.length > 80) {
      const prefix = normalizeLongKey(text).slice(0, 60);
      const prefixVal = prefixMap[prefix]?.[lang];
      if (prefixVal) return prefixVal;
    }
    return text;
  };
}
