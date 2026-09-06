import { GITHUB_AUTH_PROXY_URL } from './auth-config.js';
import { getOwnerCodeForPublish } from './owner-auth.js';

function proxyBase() {
  return String(GITHUB_AUTH_PROXY_URL || '').replace(/\/$/, '');
}

export function isAdminApiConfigured() {
  return Boolean(proxyBase());
}

async function request(path, { method = 'GET', body, ownerCode } = {}) {
  const base = proxyBase();
  if (!base) throw new Error('Set GITHUB_AUTH_PROXY_URL in js/auth-config.js to your Worker URL.');

  const code = ownerCode || getOwnerCodeForPublish();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (code) headers['X-Owner-Code'] = code;

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed (${response.status})`);
  }
  return data;
}

export function trackHit({ visitorId, path, owner = false } = {}) {
  const base = proxyBase();
  if (!base || !visitorId) return Promise.resolve({ skipped: true });
  return fetch(`${base}/analytics/hit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ visitorId, path, owner }),
    keepalive: true,
  }).catch(() => null);
}

export const adminApi = {
  getStats: () => request('/analytics/stats'),
  listCampaigns: () => request('/jobs/campaigns'),
  getCampaign: (id) => request(`/jobs/campaigns/${id}`),
  createCampaign: (payload) => request('/jobs/campaigns', { method: 'POST', body: payload }),
  updateCampaign: (id, payload) => request(`/jobs/campaigns/${id}`, { method: 'PATCH', body: payload }),
  deleteCampaign: (id) => request(`/jobs/campaigns/${id}`, { method: 'DELETE' }),
  createApplication: (campaignId, payload) =>
    request(`/jobs/campaigns/${campaignId}/applications`, { method: 'POST', body: payload }),
  updateApplication: (campaignId, appId, payload) =>
    request(`/jobs/campaigns/${campaignId}/applications/${appId}`, { method: 'PATCH', body: payload }),
  deleteApplication: (campaignId, appId) =>
    request(`/jobs/campaigns/${campaignId}/applications/${appId}`, { method: 'DELETE' }),
  googleStatus: () => request('/google/status'),
  googleStart: () => request('/google/oauth/start', { method: 'POST', body: {} }),
  googleDisconnect: () => request('/google/disconnect', { method: 'POST', body: {} }),
  gmailSync: () => request('/google/gmail/sync', { method: 'POST', body: {} }),
  createCalendarEvent: (payload) => request('/google/calendar/event', { method: 'POST', body: payload }),
};
