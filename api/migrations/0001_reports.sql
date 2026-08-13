CREATE TABLE IF NOT EXISTS reports (
  event_id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  category TEXT NOT NULL CHECK (category IN (
    'injured-person', 'trapped-person', 'building-damage', 'fire-or-leak',
    'blocked-street', 'water-shortage', 'power-outage', 'shelter-needed',
    'food-or-medicine'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('observed', 'attention', 'immediate-risk')),
  location_cell TEXT,
  observed_at TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'unverified', 'duplicate', 'verified', 'resolved', 'expired'
  ))
);

CREATE INDEX IF NOT EXISTS reports_location_status_idx
  ON reports (location_cell, status, received_at);

CREATE INDEX IF NOT EXISTS reports_expiry_idx
  ON reports (received_at, status);
