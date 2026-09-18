/**
 * The SDK's types (Banner, BannerSettings, Purpose, ...) are declared with
 * snake_case field names, matching the admin-preview backend's raw
 * NoticeGlobalSettings-shaped dict. But the actual production SDK API
 * (trukit-dev.truconsent.io — this package's own DEFAULT_API_URL) returns
 * PURE camelCase (confirmed against a live response: `primaryColor`,
 * `rejectAllColor`, `bannerId`, `isMandatory`, `expiryPeriod`, etc. — no
 * snake_case siblings at all). Without this normalization, every field read
 * as `settings.primary_color`/`banner.banner_id`/etc. is silently
 * `undefined` against that API, which is why colors/fonts/H-Case overrides
 * never appeared even though the SDK's own logic for consuming them was
 * otherwise correct.
 *
 * This adds a snake_case alias for every camelCase key an object has (and
 * vice versa), non-destructively (existing keys are never overwritten), one
 * level deep. Applied once at the API response boundary (BannerService.ts)
 * so every existing snake_case-based read site keeps working regardless of
 * which casing convention the backend serving a given deployment actually
 * uses — mirrors truKIT-NPM's `normalizeBannerSettings()`, generalized so new
 * fields don't need a hand-maintained mapping.
 */

const camelToSnake = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const snakeToCamel = (key: string): string =>
  key.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());

/** Adds a snake_case alias for every camelCase key, and a camelCase alias
 * for every snake_case key, on a shallow copy of `obj`. Never overwrites a
 * key that's already present (so an explicit value in either casing wins). */
export function withCasingAliases<T extends Record<string, any>>(obj: T | null | undefined): T {
  if (!obj || typeof obj !== 'object') return obj as unknown as T;
  const result: Record<string, any> = { ...obj };
  for (const key of Object.keys(obj)) {
    const snake = camelToSnake(key);
    if (snake !== key && !(snake in result)) {
      result[snake] = (obj as any)[key];
    }
    const camel = snakeToCamel(key);
    if (camel !== key && !(camel in result)) {
      result[camel] = (obj as any)[key];
    }
  }
  return result as T;
}

/** Applies {@link withCasingAliases} to every item of an array (or returns
 * the input unchanged if it isn't an array). */
export function withCasingAliasesList<T extends Record<string, any>>(
  arr: T[] | null | undefined
): T[] {
  if (!Array.isArray(arr)) return (arr ?? []) as T[];
  return arr.map((item) => withCasingAliases(item));
}
