import type { Metadata } from "next";
import VerifyEmailClient from "./VerifyEmailClient";

export const metadata: Metadata = {
  title: "验证邮箱 | jadren tools",
  description: "验证 jadren tools 账户邮箱",
};

interface VerifyEmailPageProps {
  searchParams: Promise<{
    email?: string | string[];
    sent?: string | string[];
    sentAt?: string | string[];
    expiresAt?: string | string[];
  }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const sent = Array.isArray(params.sent) ? params.sent[0] : params.sent;
  const sentAtParam = Array.isArray(params.sentAt)
    ? params.sentAt[0]
    : params.sentAt;
  const expiresAtParam = Array.isArray(params.expiresAt)
    ? params.expiresAt[0]
    : params.expiresAt;
  const parsedSentAt = Number(sentAtParam);
  const parsedExpiresAt = Number(expiresAtParam);
  const initiallySent = sent === "1";
  const fallbackSentAt = initiallySent ? Date.now() : null;
  const initialSentAt =
    initiallySent && Number.isFinite(parsedSentAt) && parsedSentAt > 0
      ? parsedSentAt
      : fallbackSentAt;
  const initialExpiresAt =
    initiallySent && Number.isFinite(parsedExpiresAt) && parsedExpiresAt > 0
      ? parsedExpiresAt
      : fallbackSentAt === null
        ? null
        : fallbackSentAt + 10 * 60 * 1000;

  return (
    <VerifyEmailClient
      initialEmail={email ?? ""}
      initiallySent={initiallySent}
      initialSentAt={initialSentAt}
      initialExpiresAt={initialExpiresAt}
    />
  );
}
