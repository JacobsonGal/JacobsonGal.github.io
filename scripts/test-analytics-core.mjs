import {
  applyHit,
  buildStatsPayload,
  emptyDayStats,
  utcDayKey,
  weekDayKeys,
} from '../js/analytics-core.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const day = applyHit(emptyDayStats(), 'v1');
assert(day.pageviews === 1, 'pv');
assert(day.visitorIds.length === 1, 'unique');
const day2 = applyHit(day, 'v1');
assert(day2.pageviews === 2, 'pv2');
assert(day2.visitorIds.length === 1, 'same visitor');
const day3 = applyHit(day2, 'v2');
assert(day3.visitorIds.length === 2, 'second visitor');

const map = { [utcDayKey()]: day3 };
const stats = buildStatsPayload(map, { pageviews: 10, uniques: 4 });
assert(stats.today.pageviews === 3, 'today pv');
assert(stats.today.uniques === 2, 'today uniques');
assert(stats.all.pageviews === 10, 'all');
assert(weekDayKeys().length === 7, 'week keys');
console.log('analytics-core ok');
