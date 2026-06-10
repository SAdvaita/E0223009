# Stage 1 — REST API Design

## Campus Notification Platform — API Contract

The notification platform allows students to receive real-time updates
across three categories: **Placements**, **Events**, and **Results**.

---

### Core Notification Object

```json
{
  "ID"        : "uuid-string",
  "Type"      : "Placement | Event | Result",
  "Message"   : "string",
  "Timestamp" : "YYYY-MM-DD HH:MM:SS"
}
```

---

### Endpoints

#### GET /api/notifications

Fetch paginated notifications (client-side pagination over upstream data).

**Query Parameters:**

| Param               | Type   | Default | Description                            |
|---------------------|--------|---------|----------------------------------------|
| `page`              | int    | 1       | Page number                            |
| `limit`             | int    | 10      | Items per page (max 50)                |
| `notification_type` | string | —       | Filter: `Event`, `Result`, `Placement` |

**Response 200:**
```json
{
  "success": true,
  "notifications": [...],
  "pagination": {
    "totalItems": 20, "totalPages": 2,
    "currentPage": 1, "limit": 10,
    "hasNextPage": true, "hasPreviousPage": false
  }
}
```

**Response 400 (invalid type):**
```json
{
  "success": false,
  "message": "notification_type must be one of: Event, Result, Placement"
}
```

---

#### GET /api/notifications/priority

Returns top-N priority notifications ranked by a weighted recency score.

**Query Parameters:**

| Param | Type | Default | Description                   |
|-------|------|---------|-------------------------------|
| `n`   | int  | 10      | Top-N count to return (max 50)|

**Response 200:**
```json
{
  "success": true,
  "count": 10,
  "notifications": [
    {
      "ID": "...", "Type": "Placement",
      "Message": "CSX Corporation hiring",
      "Timestamp": "2026-06-10 04:47:25",
      "priorityScore": 2.2217
    }
  ]
}
```

---

#### GET /health

Service liveness check — no auth required.

```json
{ "status": "ok", "service": "notification-backend", "port": 5000 }
```

---

### Real-Time Delivery — Server-Sent Events (SSE)

**Chosen approach:** SSE over WebSockets for this use case.

**Rationale:**
- Unidirectional (server → client) — fits push-only notifications perfectly
- Native browser `EventSource` API — no extra library needed
- Auto-reconnects on drop
- Lower overhead than WebSocket handshake

**Event format:**
```
event: notification
data: {"ID":"...","Type":"Placement","Message":"TCS hiring","Timestamp":"..."}
```

The backend polls upstream every 30s, diffs against known IDs, and
emits only **new** notifications to connected clients.

---

# Stage 2 — Database Design

## Chosen Database: PostgreSQL

**Rationale:** ACID compliance, relational model, rich indexing, mature Node.js tooling.

## Schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  roll_no VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type notification_type NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-student read tracking via junction table
CREATE TABLE student_notification_reads (
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, notification_id)
);
```

> **Note:** This project fetches notifications live from the Affordmed evaluation API and does NOT use a local DB, per Stage 6 instructions: *"You need not store them in a database."*

## Scaling Challenges

| Challenge | Solution |
|-----------|----------|
| 5M row scans | Composite indexes + cursor pagination |
| 50k fan-out | BullMQ async workers in batches of 500 |
| Per-student reads | Junction table + partial index |
| Time-range queries | BRIN index on `created_at` |
| Feed latency | Redis cache per student (TTL 5 min) |

---

# Stage 3 — Query Analysis & Optimisation

## Original Query

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

## Problems

1. **Schema flaw:** `isRead` should NOT be a column on `notifications` — it is per-student state. It belongs in a junction table (`student_notification_reads`).
2. **`SELECT *`** fetches all columns including large blobs — wasted I/O.
3. **No composite index** on `(studentID, isRead, createdAt)` → full table scan on 5M rows.
4. **Low-cardinality boolean index** on `isRead` alone is ignored by the query planner.

## Should we index every column?

**No.** Every index adds overhead on INSERT/UPDATE/DELETE (index must be updated). Storage grows linearly. The planner uses one index per scan efficiently. Index only columns that appear in WHERE/ORDER BY of frequent queries.

## Optimised Query

```sql
-- Step 1: Partial index (only indexes unread rows — far smaller)
CREATE INDEX idx_notif_student_unread
ON notifications (student_id, created_at ASC)
WHERE is_read = false;

-- Step 2: Rewritten query
SELECT id, notification_type, message, created_at
FROM notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at ASC
LIMIT 20;
```

## Placement notifications in last 7 days

```sql
CREATE INDEX idx_notif_type_created ON notifications (notification_type, created_at DESC);

SELECT DISTINCT student_id FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

---

# Stage 4 — Performance & Caching Strategy

## Recommended Architecture

```
Client → Nginx (HTTP cache, non-personalised) → Express Backend
  → Redis (check cache first)  ← hit → return to client
  → PostgreSQL Read Replica    ← miss → populate Redis → return
```

## Strategies Compared

| Strategy | Pros | Cons |
|----------|------|------|
| **Redis cache** (recommended) | 95%+ DB read reduction, sub-ms reads | Stale within TTL, invalidation complexity |
| Pagination + LIMIT | Simple, always fresh | DB hit every page |
| CDN (public content) | Zero server load for public events | Only for non-personalised data |
| HTTP Cache-Control | Zero cost for identical requests | Breaks with per-user filters |
| DB Read Replicas | Horizontal read scaling | 100–500ms replication lag |

**Recommended flow:** Redis with TTL=5min for each student's feed. On new notification broadcast → invalidate affected keys (or use pub/sub). Event notifications (public) served from CDN.

---

# Stage 5 — Bulk Notification Redesign

## Original Pseudocode

```
for student_id in student_ids:
    send_email(student_id, message)
    save_to_db(student_id, message)
    push_to_app(student_id, message)
```

## Shortcomings

1. **Sequential fan-out** — 50k students processed one at a time (minutes of latency)
2. **No fault isolation** — if `send_email` crashes at student 200, 201–50k never notified
3. **Tight coupling** — slow email API blocks DB writes in the same loop
4. **No retry** — failed deliveries permanently lost
5. **Should DB save and email happen together?** — **No.** DB save is fast and is source of truth. Email is slow and can fail. They must be decoupled.

## Revised Design

```
function notify_all(student_ids, message):
    // Step 1: Bulk INSERT to DB immediately (source of truth)
    batch_save_to_db(student_ids, message)

    // Step 2: Enqueue async delivery jobs (non-blocking)
    for batch in chunk(student_ids, size=500):
        enqueue(queue="email_delivery",  payload={batch, message})
        enqueue(queue="push_delivery",   payload={batch, message})

worker email_delivery(batch, message):
    for student_id in batch:
        try: send_email(student_id, message)
        catch: retry(max=3, backoff="exponential")
        on_failure: log_to_dead_letter_queue(student_id)

worker push_delivery(batch, message):
    for student_id in batch:
        try: push_to_app(student_id, message)
        catch: retry(max=3, backoff="exponential")
```

**Key improvements:** Instant bulk DB insert → async email/push via BullMQ → independent failure domains → dead-letter queue for audit.

---

# Stage 6 — Priority Inbox Algorithm

## Scoring Formula

```
priority_score = type_weight × recency_factor

type_weight:    Placement = 3 | Result = 2 | Event = 1
recency_factor: 1 / (1 + age_in_hours × 0.05)
```

Decay rate 0.05 means ~5% priority loss per hour — newer notifications surface even if lower type weight.

## Algorithm: Min-Heap of Size N

**Why min-heap?** To find top-N from M notifications without sorting all M:

1. Maintain a min-heap of capacity N (root = weakest item in current top-N)
2. For each notification: compute score
   - If heap size < N → push directly
   - Else if score > heap root → pop root, push new item
3. Drain heap, sort descending → top-N results

**Time complexity: O(M log N)** — optimal when M >> N

## Maintaining Top-10 as New Notifications Arrive

A background job (setInterval 60s) re-fetches latest notifications from upstream and re-runs `computeTopN`. The algorithm is stateless and idempotent — it naturally promotes new high-priority items and ages out old ones via the recency factor. Combined with SSE, score updates push to connected clients in real-time.

**Implementation:** `notification_app_be/services/priority.service.js`
