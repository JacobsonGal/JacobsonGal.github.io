/** Pure helpers for job-search campaigns (Huntr-style boards). */

export const APPLICATION_STAGES = [
  'wishlist',
  'applied',
  'interview',
  'offer',
  'rejected',
  'ghosted',
];

export const STAGE_LABELS = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
};

export function createId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}`;
}

export function createCampaign({ name, status = 'active' } = {}) {
  const now = new Date().toISOString();
  return {
    id: createId('camp'),
    name: String(name || 'Untitled search').trim() || 'Untitled search',
    status: status === 'archived' ? 'archived' : 'active',
    createdAt: now,
    updatedAt: now,
  };
}

export function createApplication(input = {}) {
  const now = new Date().toISOString();
  const stage = APPLICATION_STAGES.includes(input.stage) ? input.stage : 'wishlist';
  return {
    id: createId('app'),
    company: String(input.company || '').trim() || 'Company',
    role: String(input.role || '').trim() || 'Role',
    location: String(input.location || '').trim(),
    url: String(input.url || '').trim(),
    stage,
    notes: String(input.notes || '').trim(),
    interviewAt: input.interviewAt || null,
    calendarEventId: input.calendarEventId || null,
    emails: Array.isArray(input.emails) ? input.emails : [],
    createdAt: now,
    updatedAt: now,
  };
}

export function moveApplication(app, stage) {
  if (!APPLICATION_STAGES.includes(stage)) return app;
  return { ...app, stage, updatedAt: new Date().toISOString() };
}

export function groupApplicationsByStage(applications = []) {
  const groups = Object.fromEntries(APPLICATION_STAGES.map((stage) => [stage, []]));
  applications.forEach((app) => {
    const stage = APPLICATION_STAGES.includes(app.stage) ? app.stage : 'wishlist';
    groups[stage].push(app);
  });
  return groups;
}
