CREATE TABLE IF NOT EXISTS reminder_event (
  reminder_id UUID PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  note TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  next_remind_at TIMESTAMPTZ NOT NULL,
  repeat_interval_minutes INTEGER DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT reminder_event_title_length CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT reminder_event_note_length CHECK (char_length(note) BETWEEN 1 AND 5000),
  CONSTRAINT reminder_event_repeat_interval CHECK (
    repeat_interval_minutes IS NULL OR
    repeat_interval_minutes BETWEEN 30 AND 525600
  )
);

CREATE INDEX IF NOT EXISTS reminder_event_user_created_at_idx
  ON reminder_event (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reminder_event_due_idx
  ON reminder_event (next_remind_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS reminder_delivery (
  delivery_id UUID PRIMARY KEY,
  event_key VARCHAR(160) NOT NULL UNIQUE,
  reminder_id UUID DEFAULT NULL
    REFERENCES reminder_event(reminder_id) ON UPDATE CASCADE ON DELETE SET NULL,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'rate_limited')),
  provider_email_id TEXT DEFAULT NULL,
  quota_warning BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS reminder_delivery_user_hour_idx
  ON reminder_delivery (user_id, processed_at DESC) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS reminder_delivery_reminder_idx
  ON reminder_delivery (reminder_id, processed_at DESC);

COMMENT ON TABLE reminder_event IS 'User-owned one-time and repeating email reminder schedules.';
COMMENT ON TABLE reminder_delivery IS 'Reminder email delivery and per-UTC-hour rate-limit audit log.';

CREATE TABLE IF NOT EXISTS email_audit_log (
  audit_id UUID PRIMARY KEY,
  user_id UUID DEFAULT NULL,
  reminder_id UUID DEFAULT NULL,
  category VARCHAR(32) NOT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  sender_email VARCHAR(320) NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT NOT NULL,
  content_sha256 CHAR(64) NOT NULL,
  idempotency_key VARCHAR(256) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  provider_email_id TEXT DEFAULT NULL,
  failure_message TEXT DEFAULT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_audit_log_user_created_at_idx
  ON email_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_audit_log_reminder_created_at_idx
  ON email_audit_log (reminder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_audit_log_status_created_at_idx
  ON email_audit_log (status, created_at DESC);

COMMENT ON TABLE email_audit_log IS
  'Immutable-content audit copies and delivery state for every outbound application email.';
