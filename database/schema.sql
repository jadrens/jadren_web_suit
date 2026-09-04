CREATE TABLE IF NOT EXISTS user_main (
  user_id UUID PRIMARY KEY,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL UNIQUE,
  phone VARCHAR(32) DEFAULT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_bcrypt TEXT NOT NULL,
  status SMALLINT NOT NULL DEFAULT 0 CHECK (status IN (0, 1, 2)),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE user_main
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'user_main'
       AND column_name = 'blog_editor'
  ) THEN
    UPDATE user_main SET is_admin = TRUE WHERE blog_editor = TRUE;
  END IF;
END $$;

ALTER TABLE user_main DROP COLUMN IF EXISTS blog_editor;

CREATE TABLE IF NOT EXISTS email_verification_code (
  email VARCHAR(320) PRIMARY KEY
    REFERENCES user_main(email) ON UPDATE CASCADE ON DELETE CASCADE,
  code_bcrypt TEXT NOT NULL,
  expire_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS email_verification_code_expire_at_idx
  ON email_verification_code (expire_at);

CREATE TABLE IF NOT EXISTS unscrible (
  email VARCHAR(320) PRIMARY KEY,
  scrible SMALLINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE unscrible IS
  'Email-level subscription or service notification preferences.';
COMMENT ON COLUMN unscrible.scrible IS
  'Reserved 2-byte value for future subscription or notification state.';

CREATE TABLE IF NOT EXISTS quick_link (
  short_name VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expire_at TIMESTAMPTZ NOT NULL,
  click_count BIGINT NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  CONSTRAINT quick_link_short_name_format
    CHECK (short_name ~ '^[A-Za-z0-9]{1,64}$')
);

CREATE INDEX IF NOT EXISTS quick_link_user_created_at_idx
  ON quick_link (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quick_link_expire_at_idx
  ON quick_link (expire_at);

CREATE TABLE IF NOT EXISTS vocabulary_usage (
  usage_id UUID PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  word VARCHAR(100) NOT NULL,
  usage_prompt VARCHAR(500) NOT NULL,
  last_learn_time TIMESTAMPTZ DEFAULT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
  recent_results BOOLEAN[] NOT NULL DEFAULT ARRAY[]::BOOLEAN[],
  last_8_correct_rate VARCHAR(8) NOT NULL DEFAULT '0/0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vocabulary_usage_word_length CHECK (char_length(btrim(word)) BETWEEN 1 AND 100),
  CONSTRAINT vocabulary_usage_prompt_length CHECK (char_length(btrim(usage_prompt)) BETWEEN 1 AND 500),
  CONSTRAINT vocabulary_usage_recent_results CHECK (cardinality(recent_results) <= 8),
  UNIQUE (user_id, word, usage_prompt)
);

CREATE INDEX IF NOT EXISTS vocabulary_usage_user_learning_idx
  ON vocabulary_usage (user_id, last_learn_time ASC NULLS FIRST, created_at ASC);

CREATE TABLE IF NOT EXISTS vocabulary_practice_attempt (
  attempt_id UUID PRIMARY KEY,
  usage_id UUID NOT NULL
    REFERENCES vocabulary_usage(usage_id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  question TEXT NOT NULL,
  example_sentence TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  feedback TEXT NOT NULL,
  corrected_sentence TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vocabulary_attempt_usage_created_idx
  ON vocabulary_practice_attempt (usage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vocabulary_attempt_user_created_idx
  ON vocabulary_practice_attempt (user_id, created_at DESC);

COMMENT ON TABLE vocabulary_usage IS
  'User-owned vocabulary meanings/usages and spaced-practice statistics.';
COMMENT ON TABLE vocabulary_practice_attempt IS
  'The five most recent sentence-practice attempts retained for each vocabulary usage.';

COMMENT ON TABLE quick_link IS
  'User-managed short-link metadata. Redirect handling is implemented by another service.';
COMMENT ON COLUMN quick_link.target_url IS
  'HTTP or HTTPS destination managed by the short-link redirect service.';
COMMENT ON COLUMN quick_link.note IS
  'Optional user-provided note for identifying the short link.';

CREATE TABLE IF NOT EXISTS reminder_event (
  reminder_id UUID PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  note TEXT NOT NULL,
  remind_at TIMESTAMPTZ DEFAULT NULL,
  next_remind_at TIMESTAMPTZ DEFAULT NULL,
  repeat_interval_minutes INTEGER DEFAULT NULL,
  schedule_type VARCHAR(16) NOT NULL DEFAULT 'one_time',
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT reminder_event_title_length
    CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT reminder_event_note_length
    CHECK (char_length(note) BETWEEN 1 AND 5000),
  CONSTRAINT reminder_event_repeat_interval CHECK (
    repeat_interval_minutes IS NULL OR
    repeat_interval_minutes BETWEEN 30 AND 525600
  ),
  CONSTRAINT reminder_event_schedule_type
    CHECK (schedule_type IN ('one_time', 'repeat', 'never')),
  CONSTRAINT reminder_event_schedule_values CHECK (
    (schedule_type = 'never' AND remind_at IS NULL AND next_remind_at IS NULL
      AND repeat_interval_minutes IS NULL AND status = 'paused') OR
    (schedule_type = 'one_time' AND remind_at IS NOT NULL AND next_remind_at IS NOT NULL
      AND repeat_interval_minutes IS NULL) OR
    (schedule_type = 'repeat' AND remind_at IS NOT NULL AND next_remind_at IS NOT NULL
      AND repeat_interval_minutes IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS reminder_event_user_created_at_idx
  ON reminder_event (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reminder_event_due_idx
  ON reminder_event (next_remind_at) WHERE status = 'active';

COMMENT ON TABLE reminder_event IS
  'User-owned one-time, repeating, and non-email reminder items.';

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

COMMENT ON TABLE reminder_delivery IS
  'Reminder email delivery and per-UTC-hour rate-limit audit log.';

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

CREATE TABLE IF NOT EXISTS blog_post_view (
  slug TEXT PRIMARY KEY,
  view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE blog_post_view IS
  'Persistent page-view totals for blog posts.';

CREATE TABLE IF NOT EXISTS blog_post (
  post_id UUID PRIMARY KEY,
  author_id UUID DEFAULT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('en', 'zh')),
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(240) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (locale, slug),
  CONSTRAINT blog_post_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_post_title_length CHECK (char_length(title) BETWEEN 1 AND 240)
);

CREATE INDEX IF NOT EXISTS blog_post_locale_published_at_idx
  ON blog_post (locale, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_post_author_updated_at_idx
  ON blog_post (author_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS blog_post_contributor (
  post_id UUID NOT NULL
    REFERENCES blog_post(post_id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  contribution_count INTEGER NOT NULL DEFAULT 1 CHECK (contribution_count > 0),
  first_contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS blog_post_contributor_user_idx
  ON blog_post_contributor (user_id, last_contributed_at DESC);

CREATE TABLE IF NOT EXISTS blog_post_tag (
  post_id UUID NOT NULL
    REFERENCES blog_post(post_id) ON UPDATE CASCADE ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  PRIMARY KEY (post_id, tag),
  CONSTRAINT blog_post_tag_length CHECK (char_length(tag) BETWEEN 1 AND 50)
);

CREATE INDEX IF NOT EXISTS blog_post_tag_tag_idx ON blog_post_tag (tag);

CREATE TABLE IF NOT EXISTS blog_post_pending (
  pending_id UUID PRIMARY KEY,
  post_id UUID DEFAULT NULL
    REFERENCES blog_post(post_id) ON UPDATE CASCADE ON DELETE CASCADE,
  author_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  owner_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  last_edited_user UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  forked_from_pending_id UUID DEFAULT NULL,
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('en', 'zh')),
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(240) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_post_pending_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_post_pending_title_length CHECK (char_length(title) BETWEEN 1 AND 240)
);

CREATE INDEX IF NOT EXISTS blog_post_pending_author_updated_at_idx
  ON blog_post_pending (author_id, updated_at DESC);

ALTER TABLE blog_post_pending ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE blog_post_pending ADD COLUMN IF NOT EXISTS last_edited_user UUID;
ALTER TABLE blog_post_pending ADD COLUMN IF NOT EXISTS forked_from_pending_id UUID;
UPDATE blog_post_pending SET owner_id = author_id WHERE owner_id IS NULL;
UPDATE blog_post_pending SET last_edited_user = author_id WHERE last_edited_user IS NULL;
ALTER TABLE blog_post_pending ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE blog_post_pending ALTER COLUMN last_edited_user SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_pending_owner_id_fkey') THEN
    ALTER TABLE blog_post_pending ADD CONSTRAINT blog_post_pending_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_pending_last_edited_user_fkey') THEN
    ALTER TABLE blog_post_pending ADD CONSTRAINT blog_post_pending_last_edited_user_fkey
      FOREIGN KEY (last_edited_user) REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE blog_post_pending
  DROP CONSTRAINT IF EXISTS blog_post_pending_post_id_key;
ALTER TABLE blog_post_pending
  DROP CONSTRAINT IF EXISTS blog_post_pending_author_id_locale_slug_key;

DROP INDEX IF EXISTS blog_post_pending_author_post_idx;
CREATE UNIQUE INDEX blog_post_pending_author_post_idx
  ON blog_post_pending (owner_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS blog_post_pending_owner_locale_slug_idx
  ON blog_post_pending (owner_id, locale, slug);

CREATE TABLE IF NOT EXISTS blog_post_pending_tag (
  pending_id UUID NOT NULL
    REFERENCES blog_post_pending(pending_id) ON UPDATE CASCADE ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  PRIMARY KEY (pending_id, tag),
  CONSTRAINT blog_post_pending_tag_length CHECK (char_length(tag) BETWEEN 1 AND 50)
);

CREATE INDEX IF NOT EXISTS blog_post_pending_tag_tag_idx
  ON blog_post_pending_tag (tag);

CREATE TABLE IF NOT EXISTS blog_post_rejection (
  rejection_id UUID PRIMARY KEY,
  pending_id UUID NOT NULL UNIQUE,
  author_id UUID DEFAULT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  rejected_by UUID DEFAULT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  recipient_email VARCHAR(320) NOT NULL,
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('en', 'zh')),
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(240) NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  notification_status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending', 'sent', 'failed')),
  provider_email_id TEXT DEFAULT NULL,
  failure_message TEXT DEFAULT NULL,
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_post_rejection_reason_length
    CHECK (char_length(reason) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS blog_post_rejection_author_rejected_at_idx
  ON blog_post_rejection (author_id, rejected_at DESC);

COMMENT ON TABLE blog_post IS 'Published Markdown articles; PostgreSQL is the canonical article store.';
COMMENT ON TABLE blog_post_pending IS 'User-owned new-article drafts and unpublished edits.';
COMMENT ON TABLE blog_post_rejection IS 'Audit record for rejected pending submissions and notification delivery.';
