CREATE TABLE IF NOT EXISTS user_main (
  user_id UUID PRIMARY KEY,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL UNIQUE,
  phone VARCHAR(32) DEFAULT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_bcrypt TEXT NOT NULL,
  status SMALLINT NOT NULL DEFAULT 0 CHECK (status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS email_verification_code (
  email VARCHAR(320) PRIMARY KEY
    REFERENCES user_main(email) ON UPDATE CASCADE ON DELETE CASCADE,
  code_bcrypt TEXT NOT NULL,
  expire_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS email_verification_code_expire_at_idx
  ON email_verification_code (expire_at);
