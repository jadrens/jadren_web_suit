import type { Metadata } from "next";
import VerifyEmailClient from "../account/components/VerifyEmailClient";
import AccountProviders from "../account/AccountProviders";

export const metadata: Metadata = {
  title: "验证邮箱 | jadren",
  description: "验证 jadren 账户邮箱",
};

interface VerifyEmailPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const sent = first(params.sent) === "1";
  const parsedSentAt = Number(first(params.sentAt));
  const parsedExpiresAt = Number(first(params.expiresAt));

  return (
    <AccountProviders>
      <VerifyEmailClient
        initialEmail={first(params.email) ?? ""}
        initiallySent={sent}
        initialSentAt={sent && Number.isFinite(parsedSentAt) && parsedSentAt > 0 ? parsedSentAt : null}
        initialExpiresAt={sent && Number.isFinite(parsedExpiresAt) && parsedExpiresAt > 0 ? parsedExpiresAt : null}
      />
    </AccountProviders>
  );
}
