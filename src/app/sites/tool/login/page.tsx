import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "登录 | jadren tools",
  description: "登录 jadren tools 账户",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const safeNext =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/";
  return <LoginClient nextPath={safeNext} />;
}
