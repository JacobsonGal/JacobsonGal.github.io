/** Pure helpers for visitor analytics counters (testable without DOM/KV). */

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function startOfUtcWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = (day + 6) % 7; // Monday-start week
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export function weekDayKeys(date = new Date()) {
  const start = startOfUtcWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return utcDayKey(d);
  });
}

export function emptyDayStats() {
  return { pageviews: 0, visitorIds: [] };
}

export function applyHit(dayStats, visitorId) {
  const next = {
    pageviews: Number(dayStats?.pageviews || 0) + 1,
    visitorIds: Array.isArray(dayStats?.visitorIds) ? [...dayStats.visitorIds] : [],
  };
  if (visitorId && !next.visitorIds.includes(visitorId)) {
    next.visitorIds.push(visitorId);
  }
  return next;
}

export function summarizeDays(dayMap, keys) {
  let pageviews = 0;
  const uniques = new Set();
  keys.forEach((key) => {
    const day = dayMap[key] || emptyDayStats();
    pageviews += Number(day.pageviews || 0);
    (day.visitorIds || []).forEach((id) => uniques.add(id));
  });
  return { pageviews, uniques: uniques.size };
}

export function buildStatsPayload(dayMap, allTime, now = new Date()) {
  const todayKey = utcDayKey(now);
  const today = summarizeDays(dayMap, [todayKey]);
  const week = summarizeDays(dayMap, weekDayKeys(now));
  return {
    today,
    week,
    all: {
      pageviews: Number(allTime?.pageviews || 0),
      uniques: Number(allTime?.uniques || 0),
    },
    generatedAt: now.toISOString(),
  };
}
