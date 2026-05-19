import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeBuilderPreviewWebsite, fetchProximaWebsite } from '../src/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('makeBuilderPreviewWebsite', () => {
  it('returns a synthetic website with the provided ids', () => {
    const result = makeBuilderPreviewWebsite({ websiteId: 'ws-1', businessId: 'biz-1', domain: 'preview.localhost' });
    expect(result.id).toBe('ws-1');
    expect(result.business_id).toBe('biz-1');
    expect(result.domain).toBe('preview.localhost');
  });

  it('includes default capabilities', () => {
    const result = makeBuilderPreviewWebsite({ websiteId: 'ws-1', businessId: 'biz-1', domain: 'x.localhost' });
    expect(result.capabilities).toBeDefined();
  });
});

describe('fetchProximaWebsite', () => {
  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Not found' }),
    }));
    await expect(
      fetchProximaWebsite({ baseUrl: 'http://api.test', domain: 'no.localhost' }),
    ).rejects.toThrow();
  });

  it('calls the resolve endpoint with the domain', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ws-99', business_id: 'biz-99', domain: 'test.localhost', capabilities: {} }),
    }));
    await fetchProximaWebsite({ baseUrl: 'http://api.test', domain: 'test.localhost' });
    const calledUrl = String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl).toContain('test.localhost');
    expect(calledUrl).toContain('websites/resolve');
  });
});
