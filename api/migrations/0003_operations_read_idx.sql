CREATE INDEX IF NOT EXISTS reports_status_received_event_idx
  ON reports (status, received_at DESC, event_id DESC);
