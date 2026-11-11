import type { Metadata } from "next";
import ResetPasswordClient from "../account/components/ResetPasswordClient";
import AccountProviders from "../account/AccountProviders";

export const metadata: Metadata = {
  title: "重置密码",
  description: "重置 jadren 账户密码",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ email?: string | string[] }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  return (
    <AccountProviders>
      <ResetPasswordClient initialEmail={(email ?? "").slice(0, 320)} />
    </AccountProviders>
  );
}
