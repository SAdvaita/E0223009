/**
 * Priority Service — Stage 6
 *
 * Implements a min-heap-based priority inbox algorithm.
 *
 * Priority Score = type_weight × recency_factor
 *
 * Type Weights:
 *   Placement → 3  (highest — impacts student careers)
 *   Result    → 2  (academic outcomes)
 *   Event     → 1  (informational)
 *
 * Recency Factor:
 *   recency = 1 / (1 + age_in_hours × DECAY_RATE)
 *   Newer notifications score higher within the same type.
 *
 * Algorithm:
 *   Use a min-heap of capacity N to find top-N in O(M log N) time.
 *   This is optimal when M >> N (large notification feeds).
 *
 *   Why min-heap of size N?
 *   - We maintain exactly N "best so far" items.
 *   - The heap root is always the WEAKEST item in our current top-N.
 *   - If a new item beats the root, we evict the root and insert the new item.
 *   - O(log N) per insertion vs O(M log M) for a full sort.
 */

const TYPE_WEIGHTS = {
  Placement: 3,
  Result   : 2,
  Event    : 1,
};

// Controls how fast old notifications lose priority (per hour)
const DECAY_RATE = 0.05;

/**
 * Compute the priority score for a single notification.
 * @param   {Object} notification
 * @returns {number} score — higher means higher priority
 */
export function computeScore(notification) {
  const weight    = TYPE_WEIGHTS[notification.Type] ?? 1;
  const ts        = new Date(notification.Timestamp.replace(' ', 'T'));
  const ageHours  = (Date.now() - ts.getTime()) / (1_000 * 60 * 60);
  const recency   = 1 / (1 + ageHours * DECAY_RATE);
  return weight * recency;
}

// ── Min-Heap ──────────────────────────────────────────────────────────────────
// Stores { score, notification } ordered by score ascending.
// The root is always the minimum score (weakest element in top-N).

class MinHeap {
  constructor() { this._d = []; }

  get size()   { return this._d.length; }
  peek()       { return this._d[0]; }

  push(item) {
    this._d.push(item);
    this._up(this._d.length - 1);
  }

  pop() {
    const top  = this._d[0];
    const last = this._d.pop();
    if (this._d.length > 0) {
      this._d[0] = last;
      this._down(0);
    }
    return top;
  }

  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._d[p].score <= this._d[i].score) break;
      [this._d[p], this._d[i]] = [this._d[i], this._d[p]];
      i = p;
    }
  }

  _down(i) {
    const n = this._d.length;
    for (;;) {
      let s = i, l = (i << 1) + 1, r = l + 1;
      if (l < n && this._d[l].score < this._d[s].score) s = l;
      if (r < n && this._d[r].score < this._d[s].score) s = r;
      if (s === i) break;
      [this._d[s], this._d[i]] = [this._d[i], this._d[s]];
      i = s;
    }
  }
}

/**
 * Returns the top N highest-priority notifications.
 * Time complexity: O(M log N)
 *
 * @param {Array}  notifications  Full list from upstream
 * @param {number} n              Number of top items to return
 * @returns {Array}               Top-N notifications, sorted by score descending,
 *                                each annotated with priorityScore.
 */
export function computeTopN(notifications, n) {
  const heap = new MinHeap();

  for (const notif of notifications) {
    const score = computeScore(notif);

    if (heap.size < n) {
      heap.push({ score, notification: notif });
    } else if (heap.size > 0 && score > heap.peek().score) {
      // New item beats the weakest item in top-N — swap it in
      heap.pop();
      heap.push({ score, notification: notif });
    }
  }

  // Drain heap and sort descending (highest priority first)
  const results = [];
  while (heap.size > 0) results.push(heap.pop());
  results.sort((a, b) => b.score - a.score);

  return results.map(({ score, notification }) => ({
    ...notification,
    priorityScore: parseFloat(score.toFixed(4)),
  }));
}
