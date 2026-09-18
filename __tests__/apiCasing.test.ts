import { withCasingAliases, withCasingAliasesList } from '../src/utils/apiCasing';

describe('withCasingAliases', () => {
  it('adds a snake_case alias for every camelCase key', () => {
    const result = withCasingAliases({ primaryColor: '#000000', hCaseProceedButtonColor: '#22c55e' });
    expect(result.primary_color).toBe('#000000');
    expect(result.h_case_proceed_button_color).toBe('#22c55e');
    // Originals are preserved
    expect(result.primaryColor).toBe('#000000');
    expect(result.hCaseProceedButtonColor).toBe('#22c55e');
  });

  it('adds a camelCase alias for every snake_case key', () => {
    const result = withCasingAliases({ primary_color: '#000000', reject_all_color: '#dc2626' });
    expect(result.primaryColor).toBe('#000000');
    expect(result.rejectAllColor).toBe('#dc2626');
  });

  it('never overwrites an existing key in either casing', () => {
    const result = withCasingAliases({ primaryColor: '#111111', primary_color: '#222222' });
    expect(result.primaryColor).toBe('#111111');
    expect(result.primary_color).toBe('#222222');
  });

  it('passes through null/undefined unchanged', () => {
    expect(withCasingAliases(null)).toBeNull();
    expect(withCasingAliases(undefined)).toBeUndefined();
  });

  it('is a no-op for a key with no case variation (single word)', () => {
    const result = withCasingAliases({ id: '123', version: 2 });
    expect(result).toEqual({ id: '123', version: 2 });
  });
});

describe('withCasingAliasesList', () => {
  it('applies withCasingAliases to every item', () => {
    const result = withCasingAliasesList([{ isMandatory: true }, { isMandatory: false }]);
    expect(result[0].is_mandatory).toBe(true);
    expect(result[1].is_mandatory).toBe(false);
  });

  it('returns an empty array for null/undefined', () => {
    expect(withCasingAliasesList(null)).toEqual([]);
    expect(withCasingAliasesList(undefined)).toEqual([]);
  });
});
