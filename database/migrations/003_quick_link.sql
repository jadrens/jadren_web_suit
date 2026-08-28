CREATE TABLE IF NOT EXISTS quick_link (
  short_name VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES user_main(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
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

COMMENT ON TABLE quick_link IS
  'User-managed short-link metadata. Redirect handling is implemented by another service.';

