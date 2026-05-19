import { describe, it, expect } from 'vitest';
import { resolveCmsTenantFromUrl } from '../src/index.js';

const fallback = { websiteId: 'ws-default', businessId: 'biz-default' };

describe('resolveCmsTenantFromUrl', () => {
  it('returns fallback outside preview mode', () => {
    const url = new URL('http://localhost/');
    expect(resolveCmsTenantFromUrl(url, fallback)).toEqual(fallback);
  });

  it('overrides websiteId in preview mode via builder_website_id', () => {
    const url = new URL('http://localhost/?cms_preview=1&builder_website_id=ws-override');
    const result = resolveCmsTenantFromUrl(url, fallback);
    expect(result.websiteId).toBe('ws-override');
    expect(result.businessId).toBe('biz-default');
  });

  it('overrides both ids in preview mode', () => {
    const url = new URL('http://localhost/?cms_preview=1&builder_website_id=ws-x&builder_business_id=biz-x');
    const result = resolveCmsTenantFromUrl(url, fallback);
    expect(result.websiteId).toBe('ws-x');
    expect(result.businessId).toBe('biz-x');
  });

  it('falls back to website_id if builder_website_id absent', () => {
    const url = new URL('http://localhost/?cms_preview=1&website_id=ws-y');
    const result = resolveCmsTenantFromUrl(url, fallback);
    expect(result.websiteId).toBe('ws-y');
  });
});
