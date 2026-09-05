import type { Metadata } from "next";
import LoginClient from "../account/components/LoginClient";
import AccountProviders from "../account/AccountProviders";
import { isSafeAccountReturn } from "@lib/account-url";

export const metadata: Metadata = {
  title: "登录 | jadren",
  description: "登录 jadren 账户",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requested = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = isSafeAccountReturn(requested) ? requested! : "/";

  return (
    <AccountProviders>
      <LoginClient nextPath={nextPath} />
    </AccountProviders>
  );
}
