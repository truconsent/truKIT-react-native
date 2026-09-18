/**
 * Unit tests for RightsCenterApi's non-SSO OTP auth and grievance-chat
 * additions: mutable auth state (setAuth), Authorization header injection,
 * and the WebSocket URL builder.
 */
import RightsCenterApi from '../src/services/rightsCenterApi';

describe('RightsCenterApi auth state', () => {
  it('has no userId/authToken by default', () => {
    const api = new RightsCenterApi('https://trukit-dev.truconsent.io', 'my-key', 'my-org');
    expect(api.getUserId()).toBeUndefined();
  });

  it('setAuth promotes a verified OTP session (userId + authToken)', () => {
    const api = new RightsCenterApi('https://trukit-dev.truconsent.io', 'my-key', 'my-org');
    api.setAuth('dp-123', 'tok-abc');
    expect(api.getUserId()).toBe('dp-123');
  });

  it('constructor also accepts an initial authToken', () => {
    const api = new RightsCenterApi(
      'https://trukit-dev.truconsent.io',
      'my-key',
      'my-org',
      'user-1',
      'tok-initial'
    );
    expect(api.getUserId()).toBe('user-1');
  });
});

describe('RightsCenterApi.grievanceWebSocketUri', () => {
  it('converts https to wss and includes auth query params', () => {
    const api = new RightsCenterApi('https://trukit-dev.truconsent.io', 'my-key', 'my-org');
    api.setAuth('dp-1', 'my-token');
    const uri = new URL(api.grievanceWebSocketUri('ticket-1'));

    expect(uri.protocol).toBe('wss:');
    expect(uri.host).toBe('trukit-dev.truconsent.io');
    expect(uri.pathname).toBe('/ws/grievance/ticket-1');
    expect(uri.searchParams.get('token')).toBe('my-token');
    expect(uri.searchParams.get('api_key')).toBe('my-key');
    expect(uri.searchParams.get('org_id')).toBe('my-org');
  });

  it('converts http to ws when the API URL is not secure', () => {
    const api = new RightsCenterApi('http://localhost:8080', 'k', 'o');
    const uri = new URL(api.grievanceWebSocketUri('t1'));
    expect(uri.protocol).toBe('ws:');
    expect(uri.port).toBe('8080');
  });

  it('sends an empty token when no authToken has been set', () => {
    const api = new RightsCenterApi('https://trukit-dev.truconsent.io', 'k', 'o');
    const uri = new URL(api.grievanceWebSocketUri('t1'));
    expect(uri.searchParams.get('token')).toBe('');
  });

  it('strips a legacy /banners suffix from apiRootUrl before building the ws URL', () => {
    const api = new RightsCenterApi('https://trukit-dev.truconsent.io/banners', 'k', 'o');
    const uri = new URL(api.grievanceWebSocketUri('t1'));
    expect(uri.host).toBe('trukit-dev.truconsent.io');
    expect(uri.pathname).toBe('/ws/grievance/t1');
  });
});

describe('RightsCenterApi.sendOtp / verifyOtp', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  it('sendOtp posts phone/countryCode/assetId to the send-otp endpoint', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    } as unknown as Response);

    const api = new RightsCenterApi('https://trukit-dev.truconsent.io', 'k', 'o');
    await api.sendOtp('9999999999', '+91', 'asset-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/internal/rights-center-access/send-otp'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ assetId: 'asset-1', phone: '9999999999', countryCode: '+91' });
  });

  it('verifyOtp parses the result and promotes userId/authToken via setAuth', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ accessToken: 'tok-xyz', dataPrincipalId: 'dp-999' }),
    } as unknown as Response);

    const api = new RightsCenterApi('https://trukit-dev.truconsent.io', 'k', 'o');
    const result = await api.verifyOtp('9999999999', '+91', '123456', 'asset-1');

    expect(result).toEqual({ accessToken: 'tok-xyz', dataPrincipalId: 'dp-999' });
    expect(api.getUserId()).toBe('dp-999');

    // Subsequent requests should now carry the Authorization header.
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    } as unknown as Response);
    await api.getDPOInfo().catch(() => undefined);
    const secondCallHeaders = (fetch as jest.Mock).mock.calls[1][1].headers;
    expect(secondCallHeaders['Authorization']).toBe('Bearer tok-xyz');
  });
});
