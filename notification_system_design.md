# Stage 1

## REST API Design — Campus Notification Platform

### Overview

The notification platform allows students to receive real-time updates across three categories: **Placements**, **Events**, and **Results**.

---

### Core Entities

```json
Notification {
  "ID"        : "uuid-string",
  "Type"      : "Placement | Event | Result",
  "Message"   : "string",
  "Timestamp" : "YYYY-MM-DD HH:MM:SS",
  "isRead"    : false
}
```

---

### API Endpoints

#### 1. Get All Notifications

```
GET /api/notifications
```

**Query Parameters:**

| Param               | Type   | Default | Description                          |
|---------------------|--------|---------|--------------------------------------|
| `page`              | int    | 1       | Page number                          |
| `limit`             | int    | 10      | Items per page (max 50)              |
| `notification_type` | string | —       | Filter: `Event`, `Result`, `Placement` |

**Request Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "ID": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "Type": "Result",
      "Message": "mid-sem results published",
      "Timestamp": "2026-04-22 17:51:30"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "limit": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

#### 2. Get Priority Notifications

```
GET /api/notifications/priority
```

**Query Parameters:**

| Param | Type | Default | Description              |
|-------|------|---------|--------------------------|
| `n`   | int  | 10      | Top-N notifications to return |

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "count": 10,
  "notifications": [
    {
      "ID": "b283218f-...",
      "Type": "Placement",
      "Message": "CSX Corporation hiring",
      "Timestamp": "2026-04-22 17:51:18",
      "priorityScore": 2.8543
    }
  ]
}
```

---

### Real-Time Notification Mechanism

**Chosen approach: Server-Sent Events (SSE)**

Rationale:
- Simpler than WebSockets (unidirectional: server → client)
- Native browser support, no library needed
- Auto-reconnects on drop
- Efficient for push-only notification streams

```
GET /api/notifications/stream
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Format:**
```
event: notification
data: {"ID":"...","Type":"Placement","Message":"TCS hiring open","Timestamp":"..."}
```

The backend polls the upstream API every 30 seconds and emits `notification` events when new items are detected (diff against last known IDs).

---

# Stage 2

## Database Design

### Chosen Database: PostgreSQL

**Rationale:**
- ACID compliance ensures no notification is lost or duplicated during bulk inserts.
- Relational model fits naturally: students ↔ notifications with foreign keys.
- Rich indexing support for time-series and enum-filtered queries.
- Mature tooling (Prisma, pg) with strong TypeScript support.

---

### Schema

```sql
-- Enum for notification category
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

-- Students table
CREATE TABLE students (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) UNIQUE NOT NULL,
  name       VARCHAR(255) NOT NULL,
  roll_no    VARCHAR(50)  UNIQUE NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Notifications table (global pool — not per-student)
CREATE TABLE notifications (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type notification_type NOT NULL,
  message           TEXT              NOT NULL,
  created_at        TIMESTAMPTZ       DEFAULT NOW()
);

-- Per-student read tracking (avoids duplicating notification rows)
CREATE TABLE student_notification_reads (
  student_id      UUID REFERENCES students(id)      ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, notification_id)
);
```

---

### Scaling Challenges & Solutions

| Challenge | Problem | Solution |
|-----------|---------|----------|
| Large notification volume | 5M rows → slow full scans | Composite indexes + pagination |
| Fan-out on "Notify All" | 50k inserts in one request | Message queue (BullMQ) + batch workers |
| Read-status per student | Joining 50k students × 5M notifs = 250B rows | Junction table + partial index |
| Time-range queries | `created_at` scans without index | BRIN index on `created_at` (append-only data) |
| Notification feed per student | Full join every page load | Redis cache per student (TTL 5 min) |

---

### Key Queries

**Fetch unread notifications for a student:**
```sql
SELECT n.id, n.notification_type, n.message, n.created_at
FROM notifications n
WHERE n.id NOT IN (
  SELECT notification_id FROM student_notification_reads
  WHERE student_id = $1
)
ORDER BY n.created_at DESC
LIMIT $2 OFFSET $3;
```

**Fetch all Placement notifications in the last 7 days:**
```sql
SELECT id, message, created_at
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

# Stage 3

## Query Analysis & Optimisation

### Original Query

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

---

### Issues

**1. Accuracy:**
The schema design should NOT store `isRead` as a column on the `notifications` table. Read status is per-student, so `isRead` should live in a junction table (`student_notification_reads`). The current design conflates a global notification with per-student read state — this is a schema flaw.

**2. Why is it slow?**
- `SELECT *` — fetches all columns including any large text/blob fields; wasted I/O.
- No index on `studentID` + `isRead` + `createdAt` — triggers a full table scan on 5M rows.
- `isRead = false` has low selectivity if most notifications are unread — index on a low-cardinality boolean is weak alone.

**3. Should we index every column?**
**No.** Indexing every column is counterproductive:
- Every index adds overhead on `INSERT`, `UPDATE`, `DELETE` (index must be updated).
- Storage cost grows linearly.
- The query planner can only use one index per table scan efficiently.
- Indexes on low-cardinality columns (like booleans) are often ignored by the planner anyway.

---

### Optimised Approach

**Step 1 — Fix the schema** (as in Stage 2): use a junction table for read-tracking.

**Step 2 — Composite index:**
```sql
-- For the old schema pattern (if kept): order columns by selectivity
CREATE INDEX idx_notif_student_unread_time
ON notifications (student_id, is_read, created_at ASC)
WHERE is_read = false;  -- Partial index: only indexes unread rows
```
A **partial index** (`WHERE is_read = false`) is far more efficient than a full index — the index is smaller, fits in memory, and is only consulted when needed.

**Step 3 — Rewrite the query:**
```sql
SELECT id, notification_type AS type, message, created_at
FROM notifications
WHERE student_id = 1042
  AND is_read = false
ORDER BY created_at ASC
LIMIT 50;  -- Always paginate; never fetch unbounded
```

**Step 4 — Placement notifications in last 7 days:**
```sql
SELECT DISTINCT student_id
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

With index:
```sql
CREATE INDEX idx_notif_type_created
ON notifications (notification_type, created_at DESC);
```

---

# Stage 4

## Performance & Caching Strategy

### Problem
On every page load, the DB is queried for each student's notification feed → DB overwhelmed at scale (50k students × many page loads).

---

### Recommended Strategies

#### Strategy 1 — Redis Cache (Recommended Primary)

- Cache each student's notification feed: `key = notify:student:{id}`, `TTL = 5 min`
- On cache miss → query DB → populate cache
- On new notification → invalidate affected cache keys (or use pub/sub to push updates)

**Tradeoffs:**
- ✅ 95%+ reduction in DB reads
- ✅ Sub-millisecond reads from Redis
- ⚠️ Stale data possible within TTL window (acceptable for notifications)
- ⚠️ Cache invalidation complexity on bulk notify

---

#### Strategy 2 — Pagination + Limit

- Never return all notifications; use `LIMIT`/`OFFSET` or cursor-based pagination.
- Return only 10–20 items per load.

**Tradeoffs:**
- ✅ Simple, no extra infra
- ✅ Always fresh data
- ⚠️ DB still hit on every page change

---

#### Strategy 3 — CDN / Edge Cache for Public Content

- Event announcements (non-personalised) can be cached at CDN level.

---

#### Strategy 4 — HTTP Cache Headers

- Set `Cache-Control: max-age=60` for the notification list endpoint.
- Browser and reverse proxies (Nginx) cache responses.

**Tradeoffs:**
- ✅ Zero server load for repeat requests
- ⚠️ Only works for identical requests; breaks with per-user filters

---

#### Strategy 5 — Database Read Replicas

- Route read queries to replicas; writes go to primary.

**Tradeoffs:**
- ✅ Scales reads horizontally
- ⚠️ Replication lag: replica may be 100–500ms behind primary

---

### Recommended Architecture

```
Client
  ↓
Nginx (HTTP cache for non-personalised)
  ↓
Express Backend
  ↓
Redis (check cache first)     ← hit → return to client
  ↓ miss
PostgreSQL Read Replica       ← query → populate Redis → return
```

---

# Stage 5

## Bulk Notification Redesign

### Original Pseudocode

```
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_to_app(student_id, message)
```

---

### Shortcomings

1. **Sequential fan-out**: 50,000 students processed one at a time → extremely slow (minutes).
2. **No fault isolation**: if `send_email` fails for student 200, the loop may crash — students 201–50,000 never receive notifications.
3. **Tight coupling**: email, DB save, and push are synchronous in the same loop — a slow email API blocks DB writes.
4. **No retry mechanism**: failed deliveries are lost permanently.
5. **Should DB save and email happen together?** **No.** Saving to DB is fast and critical (source of truth); sending email is slow and can fail. They must be decoupled. DB save should happen first (synchronously), email/push via async queue.

---

### Revised Design

```
function notify_all(student_ids: array, message: string):
    // Step 1: Batch-insert all notifications to DB immediately
    // DB is the source of truth — this must succeed before anything else
    batch_save_to_db(student_ids, message)   // single bulk INSERT, fast

    // Step 2: Enqueue jobs for async delivery (non-blocking)
    for batch in chunk(student_ids, size=500):
        enqueue_job(queue="email_delivery",  payload={ batch, message })
        enqueue_job(queue="push_delivery",   payload={ batch, message })

// Worker processes (run concurrently, independently)
worker email_delivery(batch, message):
    for student_id in batch:
        try:
            send_email(student_id, message)
        catch error:
            retry(max=3, backoff="exponential")
            on_final_failure: log_to_dead_letter_queue(student_id)

worker push_delivery(batch, message):
    for student_id in batch:
        try:
            push_to_app(student_id, message)
        catch error:
            retry(max=3, backoff="exponential")
```

**Key improvements:**
- DB insert is instant (bulk INSERT, not loop)
- Email and push are fully async via a job queue (BullMQ / RabbitMQ)
- Workers process batches of 500 concurrently
- Dead-letter queue captures permanent failures for audit
- Failure of email does NOT affect push delivery (independent queues)

---

# Stage 6

## Priority Inbox Algorithm

### Approach

Priority is computed using a **weighted recency score**:

```
score = type_weight × recency_factor

type_weight:
  Placement → 3
  Result    → 2
  Event     → 1

recency_factor = 1 / (1 + age_in_hours × 0.05)
```

The decay rate (0.05) means a notification loses ~5% priority per hour of age, ensuring new notifications surface even if their type weight is lower.

---

### Algorithm: Min-Heap of Size N

To find the top-N without sorting all M notifications:

1. Maintain a **min-heap** of capacity N (root = weakest item in current top-N).
2. For each notification:
   - Compute score.
   - If heap size < N → push directly.
   - Else if score > heap root → pop root, push new item.
3. Drain heap, sort descending → top-N results.

**Time complexity: O(M log N)** — optimal when M >> N.

---

### How to maintain top-10 as new notifications arrive

Use a **sliding window heap** with a background job:
- Every 60 seconds, re-fetch latest notifications from upstream.
- Re-run the computeTopN algorithm (stateless, idempotent).
- The algorithm naturally incorporates new arrivals and ages out old ones via the recency factor.
- For real-time updates, combine with SSE: push score updates to connected clients.

The implementation lives in `notification_app_be/services/priority.service.js`.
