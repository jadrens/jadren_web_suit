ALTER TABLE quick_link
  ADD COLUMN IF NOT EXISTS target_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS note VARCHAR(255) DEFAULT NULL;

ALTER TABLE quick_link
  ALTER COLUMN target_url DROP DEFAULT;

COMMENT ON COLUMN quick_link.target_url IS
  'HTTP or HTTPS destination managed by the short-link redirect service.';

COMMENT ON COLUMN quick_link.note IS
  'Optional user-provided note for identifying the short link.';

