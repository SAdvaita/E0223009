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
