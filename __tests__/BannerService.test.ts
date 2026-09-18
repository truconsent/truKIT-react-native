/**
 * Unit tests for BannerService
 */
import { fetchBanner, submitConsent } from '../src/core/BannerService';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('BannerService', () => {
  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe('fetchBanner', () => {
    it('should fetch banner successfully', async () => {
      const mockBanner = {
        banner_id: 'test-banner',
        collection_point: 'test-cp',
        version: '1',
        title: 'Test Banner',
        expiry_type: 'active',
        purposes: [],
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockBanner,
      } as Response);

      const result = await fetchBanner({
        bannerId: 'test-banner',
        apiKey: 'test-key',
        organizationId: 'test-org',
        apiUrl: 'https://api.example.com',
      });

      // fetchBanner normalizes the response to add camelCase aliases for
      // every snake_case field (see apiCasing.ts) — toMatchObject rather
      // than toEqual since the normalized result has extra alias keys.
      expect(result).toMatchObject(mockBanner);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('test-banner'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
            'X-Org-Id': 'test-org',
          }),
        })
      );
    });

    it('normalizes a pure-camelCase response (matches the real trukit-dev API shape)', async () => {
      // trukit-dev.truconsent.io — this package's own DEFAULT_API_URL —
      // returns pure camelCase with no snake_case siblings at all (confirmed
      // against a live response). Every existing read site in the SDK
      // (BannerUI.tsx, ColorUtils.ts, ModernBannerActions.tsx, ...) expects
      // snake_case, so without normalization these fields are silently
      // undefined against that API.
      const camelCaseBanner = {
        bannerId: 'CP-camel',
        title: 'Camel Banner',
        bannerSettings: {
          primaryColor: '#000000',
          buttonColor: '#95ff00',
          rejectAllColor: '#dc2626',
          onlyNecessaryColor: '#f97316',
          hCaseProceedButtonColor: '#22c55e',
          hCaseBackButtonColor: '#e3e8f2',
        },
        translationsSnapshot: {
          languages: [{ code: 'as', name: 'অসমীয়া' }],
        },
        purposes: [
          {
            id: 'p1',
            name: 'Purpose One',
            isMandatory: true,
            expiryPeriod: '365',
            dataElements: [{ id: 'de1', name: 'Email', displayId: 'DE001' }],
          },
        ],
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => camelCaseBanner,
      } as Response);

      const result: any = await fetchBanner({
        bannerId: 'CP-camel',
        apiKey: 'test-key',
        organizationId: 'test-org',
        apiUrl: 'https://api.example.com',
      });

      expect(result.banner_id).toBe('CP-camel');
      expect(result.banner_settings.primary_color).toBe('#000000');
      expect(result.banner_settings.button_color).toBe('#95ff00');
      expect(result.banner_settings.reject_all_color).toBe('#dc2626');
      expect(result.banner_settings.only_necessary_color).toBe('#f97316');
      expect(result.banner_settings.h_case_proceed_button_color).toBe('#22c55e');
      expect(result.banner_settings.h_case_back_button_color).toBe('#e3e8f2');
      expect(result.translations_snapshot).toEqual(camelCaseBanner.translationsSnapshot);
      expect(result.purposes[0].is_mandatory).toBe(true);
      expect(result.purposes[0].expiry_period).toBe('365');
      expect(result.purposes[0].data_elements[0].display_id).toBe('DE001');
    });

    it('should throw error on 401', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(
        fetchBanner({
          bannerId: 'test-banner',
          apiKey: 'invalid-key',
          organizationId: 'test-org',
          apiUrl: 'https://api.example.com',
        })
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw error on 403', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      await expect(
        fetchBanner({
          bannerId: 'test-banner',
          apiKey: 'test-key',
          organizationId: 'test-org',
          apiUrl: 'https://api.example.com',
        })
      ).rejects.toThrow('Forbidden');
    });

    it('should throw error when bannerId is missing', async () => {
      await expect(
        fetchBanner({
          bannerId: '',
          apiKey: 'test-key',
          organizationId: 'test-org',
          apiUrl: 'https://api.example.com',
        })
      ).rejects.toThrow('Missing bannerId');
    });

    it('should throw error when apiKey is missing', async () => {
      await expect(
        fetchBanner({
          bannerId: 'test-banner',
          apiKey: '',
          organizationId: 'test-org',
          apiUrl: 'https://api.example.com',
        })
      ).rejects.toThrow('Missing apiKey');
    });

    it('should throw error when organizationId is missing', async () => {
      await expect(
        fetchBanner({
          bannerId: 'test-banner',
          apiKey: 'test-key',
          organizationId: '',
          apiUrl: 'https://api.example.com',
        })
      ).rejects.toThrow('Missing organizationId');
    });

    it('should throw error when apiUrl is missing', async () => {
      await expect(
        fetchBanner({
          bannerId: 'test-banner',
          apiKey: 'test-key',
          organizationId: 'test-org',
        })
      ).rejects.toThrow('Missing apiUrl');
    });
  });

  describe('submitConsent', () => {
    it('should submit consent successfully', async () => {
      const mockResponse = {
        id: 'consent-123',
        action: 'approved',
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await submitConsent({
        collectionPointId: 'test-cp',
        userId: 'test-user',
        purposes: [],
        action: 'approved',
        apiKey: 'test-key',
        organizationId: 'test-org',
        apiUrl: 'https://api.example.com',
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/consent/test-cp'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
            'X-Org-Id': 'test-org',
          }),
        })
      );
    });

    it('should throw error when collectionPointId is missing', async () => {
      await expect(
        submitConsent({
          collectionPointId: '',
          userId: 'test-user',
          purposes: [],
          action: 'approved',
          apiKey: 'test-key',
          organizationId: 'test-org',
          apiUrl: 'https://api.example.com',
        })
      ).rejects.toThrow();
    });

    it('should throw error when apiUrl is missing', async () => {
      await expect(
        submitConsent({
          collectionPointId: 'test-cp',
          userId: 'test-user',
          purposes: [],
          action: 'approved',
          apiKey: 'test-key',
          organizationId: 'test-org',
        })
      ).rejects.toThrow('Missing apiUrl');
    });
  });
});

