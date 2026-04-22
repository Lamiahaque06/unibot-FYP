/**
 * analyticsHelpers.test.js
 * Unit tests for the six pure analytics aggregation helpers.
 *
 * No database or HTTP server required — all functions are side-effect-free.
 */

const {
  normaliseFeeStats,
  paginationMeta,
  enrollmentRate,
  groupByDepartment,
  topN,
  overdueRate,
} = require('../utils/analyticsHelpers');

// ── normaliseFeeStats ─────────────────────────────────────────────────────────
describe('normaliseFeeStats', () => {
  it('maps MongoDB $group output to a status-keyed object', () => {
    const raw = [
      { _id: 'paid',    count: 40, totalAmount: 80000 },
      { _id: 'pending', count: 10, totalAmount: 20000 },
      { _id: 'overdue', count:  5, totalAmount:  9500 },
    ];
    const result = normaliseFeeStats(raw);
    expect(result.paid).toEqual({ count: 40, totalAmount: 80000 });
    expect(result.pending).toEqual({ count: 10, totalAmount: 20000 });
    expect(result.overdue).toEqual({ count: 5, totalAmount: 9500 });
  });

  it('returns an empty object when rawStats is an empty array', () => {
    expect(normaliseFeeStats([])).toEqual({});
  });

  it('skips entries with a null _id', () => {
    const raw = [{ _id: null, count: 3, totalAmount: 500 }];
    expect(normaliseFeeStats(raw)).toEqual({});
  });
});

// ── paginationMeta ────────────────────────────────────────────────────────────
describe('paginationMeta', () => {
  it('computes pages, hasNext, and hasPrev correctly for a mid-range page', () => {
    const meta = paginationMeta(100, 3, 10);
    expect(meta.pages).toBe(10);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
    expect(meta.total).toBe(100);
  });

  it('sets hasNext=false on the last page', () => {
    const meta = paginationMeta(25, 3, 10);
    expect(meta.pages).toBe(3);
    expect(meta.hasNext).toBe(false);
  });

  it('sets hasPrev=false on page 1', () => {
    const meta = paginationMeta(50, 1, 10);
    expect(meta.hasPrev).toBe(false);
  });
});

// ── enrollmentRate ────────────────────────────────────────────────────────────
describe('enrollmentRate', () => {
  it('returns the correct integer percentage', () => {
    expect(enrollmentRate(30, 100)).toBe(30);
    expect(enrollmentRate(1, 3)).toBe(33);
  });

  it('caps the rate at 100 when enrolled exceeds capacity', () => {
    expect(enrollmentRate(120, 100)).toBe(100);
  });

  it('returns 0 when capacity is zero or falsy', () => {
    expect(enrollmentRate(10, 0)).toBe(0);
    expect(enrollmentRate(10, null)).toBe(0);
  });
});

// ── groupByDepartment ─────────────────────────────────────────────────────────
describe('groupByDepartment', () => {
  it('merges multiple stats objects belonging to the same department', () => {
    const stats = [
      { department: 'CS', courseCount: 3, totalEnrollment: 90 },
      { department: 'CS', courseCount: 2, totalEnrollment: 60 },
      { department: 'Math', courseCount: 1, totalEnrollment: 30 },
    ];
    const result = groupByDepartment(stats);
    expect(result.CS).toEqual({ courseCount: 5, totalEnrollment: 150 });
    expect(result.Math).toEqual({ courseCount: 1, totalEnrollment: 30 });
  });

  it('uses "Unknown" as the key when department is missing', () => {
    const stats = [{ courseCount: 2, totalEnrollment: 20 }];
    const result = groupByDepartment(stats);
    expect(result.Unknown).toBeDefined();
  });
});

// ── topN ──────────────────────────────────────────────────────────────────────
describe('topN', () => {
  it('returns the N highest-scoring items in descending order', () => {
    const courses = [
      { name: 'CS101', totalEnrollment: 50 },
      { name: 'MA201', totalEnrollment: 80 },
      { name: 'PH301', totalEnrollment: 30 },
    ];
    const result = topN(courses, 'totalEnrollment', 2);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('MA201');
    expect(result[1].name).toBe('CS101');
  });

  it('returns all items when N exceeds array length', () => {
    const arr = [{ v: 1 }, { v: 2 }];
    expect(topN(arr, 'v', 10)).toHaveLength(2);
  });
});

// ── overdueRate ───────────────────────────────────────────────────────────────
describe('overdueRate', () => {
  it('computes the correct overdue fraction', () => {
    const fees = [
      { status: 'paid' },
      { status: 'overdue' },
      { status: 'overdue' },
      { status: 'pending' },
    ];
    expect(overdueRate(fees)).toBe(0.5);
  });

  it('returns 0 for an empty array', () => {
    expect(overdueRate([])).toBe(0);
  });

  it('returns 0 when no fees are overdue', () => {
    const fees = [{ status: 'paid' }, { status: 'paid' }];
    expect(overdueRate(fees)).toBe(0);
  });
});
