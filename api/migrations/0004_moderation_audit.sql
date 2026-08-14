ALTER TABLE reports ADD COLUMN last_moderation_event_id TEXT;

CREATE TABLE IF NOT EXISTS report_moderation_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('verify', 'mark-duplicate', 'resolve', 'expire')),
  from_status TEXT NOT NULL CHECK (from_status IN ('unverified', 'duplicate', 'verified', 'resolved', 'expired')),
  to_status TEXT NOT NULL CHECK (to_status IN ('unverified', 'duplicate', 'verified', 'resolved', 'expired')),
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  occurred_at INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS report_moderation_events_event_idx
  ON report_moderation_events (event_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS report_moderation_events_retention_idx
  ON report_moderation_events (occurred_at);
