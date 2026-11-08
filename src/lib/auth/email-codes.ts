import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { db, firstRow, type QueryClient } from "./db";
import { sendVerificationEmail } from "./mailer";
import type { VerificationEmailLocale } from "./emails/verification-code";
import { sharedLimiter } from "@lib/rate-limit/sqlite-window";

/** register: prove an e-mail before its account exists; verify: legacy unverified accounts; reset: password reset. */
export type EmailCodePurpose = "register" | "verify" | "reset";

export const CODE_LIFETIME_MINUTES = 10;
/** Guesses allowed per code, counting correct ones; the code is then discarded. */
export const MAX_CODE_ATTEMPTS = 5;

export type EmailCodeErrorCode =
  | "invalid_verification_code"
  | "verification_code_expired"
  | "verification_attempts_exceeded";

export class EmailCodeError extends Error {
  constructor(readonly code: EmailCodeErrorCode) {
    super(code);
  }
}

// The window matches the code lifetime, so once a code's attempts are spent it
// stays unusable until it would have expired anyway.
const attemptLimiter = () =>
  sharedLimiter("email_code_attempts", [
    { windowMs: CODE_LIFETIME_MINUTES * 60_000, limit: MAX_CODE_ATTEMPTS },
  ]);

const attemptKey = (email: string, purpose: EmailCodePurpose) => `${purpose}:${email}`;

/** Creates (or replaces) the pending code for `email` and mails it. */
export async function issueEmailCode(input: {
  email: string;
  purpose: EmailCodePurpose;
  locale: VerificationEmailLocale;
  userId: string | null;
}) {
  const code = randomInt(100_000, 1_000_000).toString();
  const codeBcrypt = await bcrypt.hash(code, 10);
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + CODE_LIFETIME_MINUTES * 60_000);
  await db.query(
    `INSERT INTO email_code (email, purpose, code_bcrypt, expire_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email, purpose) DO UPDATE
       SET code_bcrypt = EXCLUDED.code_bcrypt,
           expire_at = EXCLUDED.expire_at`,
    [input.email, input.purpose, codeBcrypt, expiresAt]
  );
  // A fresh code gets a fresh set of attempts; sending is rate-limited separately.
  attemptLimiter().reset(attemptKey(input.email, input.purpose));
  await sendVerificationEmail(input.userId, input.email, code, input.locale, input.purpose);
  return { sentAt, expiresAt };
}

/**
 * Checks `code` and deletes it when it matches. Run it inside the transaction
 * that acts on the code, so a failure later in that transaction keeps the
 * code. Every check counts as an attempt before the code is even read, which
 * also bounds parallel guessing.
 */
export async function consumeEmailCode(
  client: QueryClient,
  email: string,
  purpose: EmailCodePurpose,
  code: string
) {
  if (!attemptLimiter().consume(attemptKey(email, purpose))) {
    // Outside the caller's transaction: it is about to roll back.
    await db.query("DELETE FROM email_code WHERE email = $1 AND purpose = $2", [email, purpose]);
    throw new EmailCodeError("verification_attempts_exceeded");
  }

  const result = await client.query<{ code_bcrypt: string; expire_at: Date }>(
    `SELECT code_bcrypt, expire_at
       FROM email_code
      WHERE email = $1 AND purpose = $2
      FOR UPDATE`,
    [email, purpose]
  );
  const row = firstRow(result.rows);
  if (!row) throw new EmailCodeError("invalid_verification_code");
  if (row.expire_at.getTime() <= Date.now()) throw new EmailCodeError("verification_code_expired");
  if (!(await bcrypt.compare(code, row.code_bcrypt))) throw new EmailCodeError("invalid_verification_code");

  await client.query("DELETE FROM email_code WHERE email = $1 AND purpose = $2", [email, purpose]);
  attemptLimiter().reset(attemptKey(email, purpose));
}
