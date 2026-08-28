CREATE TABLE IF NOT EXISTS unscrible (
  email VARCHAR(320) PRIMARY KEY,
  scrible SMALLINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE unscrible IS
  'Email-level subscription or service notification preferences.';

COMMENT ON COLUMN unscrible.scrible IS
  'Reserved 2-byte value for future subscription or notification state.';
