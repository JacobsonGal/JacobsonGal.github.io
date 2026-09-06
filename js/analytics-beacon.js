import { getOwnerSession } from './owner-auth.js';
import { trackHit } from './admin-api.js';

const VISITOR_KEY = 'portfolio_visitor_id';

function getOrCreateVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function initAnalyticsBeacon() {
  if (typeof window === 'undefined') return;

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const owner = Boolean(getOwnerSession()) || isLocal;
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;

  const path = `${window.location.pathname}${window.location.hash || ''}` || '/';
  trackHit({ visitorId, path, owner });
}
