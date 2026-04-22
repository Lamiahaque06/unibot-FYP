/**
 * analyticsHelpers.js
 * Pure helper functions for admin analytics aggregation.
 * Side-effect-free so they can be unit-tested without a database connection.
 */

/**
 * Normalise a MongoDB $group-by-status fee aggregation into a lookup map.
 * @param {Array<{_id: string, count: number, totalAmount: number}>} rawStats
 * @returns {Object.<string, {count: number, totalAmount: number}>}
 */
const normaliseFeeStats = (rawStats) => {
  const result = {};
  for (const entry of (rawStats || [])) {
    if (entry._id) {
      result[entry._id] = {
        count: entry.count ?? 0,
        totalAmount: entry.totalAmount ?? 0,
      };
    }
  }
  return result;
};

/**
 * Compute pagination metadata from total record count.
 * @param {number} total  - total documents matching the query
 * @param {number} page   - current page (1-based)
 * @param {number} limit  - items per page
 * @returns {{ page, limit, total, pages, hasNext, hasPrev }}
 */
const paginationMeta = (total, page, limit) => {
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
};

/**
 * Compute the course enrollment fill rate as an integer percentage.
 * @param {number} enrolled - current enrolled student count
 * @param {number} capacity - maximum course capacity
 * @returns {number} integer in [0, 100]
 */
const enrollmentRate = (enrolled, capacity) => {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(Math.round((enrolled / capacity) * 100), 100);
};

/**
 * Group course stats by department, summing courseCount and totalEnrollment.
 * @param {Array<{department: string, courseCount: number, totalEnrollment: number}>} stats
 * @returns {Object.<string, {courseCount: number, totalEnrollment: number}>}
 */
const groupByDepartment = (stats) => {
  const map = {};
  for (const s of (stats || [])) {
    const dept = s.department || 'Unknown';
    if (!map[dept]) {
      map[dept] = { courseCount: 0, totalEnrollment: 0 };
    }
    map[dept].courseCount += s.courseCount ?? 1;
    map[dept].totalEnrollment += s.totalEnrollment ?? 0;
  }
  return map;
};

/**
 * Return the top N items from an array, ranked by a numeric field descending.
 * @param {Array<Object>} arr
 * @param {string} key  - numeric field to rank by
 * @param {number} n    - how many items to return
 * @returns {Array<Object>}
 */
const topN = (arr, key, n) =>
  [...(arr || [])].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, n);

/**
 * Compute the overdue fee rate as a fraction in [0, 1].
 * @param {Array<{status: string}>} fees
 * @returns {number}
 */
const overdueRate = (fees) => {
  if (!fees || fees.length === 0) return 0;
  const overdue = fees.filter((f) => f.status === 'overdue').length;
  return parseFloat((overdue / fees.length).toFixed(4));
};

module.exports = {
  normaliseFeeStats,
  paginationMeta,
  enrollmentRate,
  groupByDepartment,
  topN,
  overdueRate,
};
