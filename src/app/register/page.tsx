import type { Metadata } from "next";
import RegisterClient from "../account/components/RegisterClient";
import AccountProviders from "../account/AccountProviders";

export const metadata: Metadata = {
  title: "注册账户 | jadren",
  description: "创建 jadren 账户",
};

export default function RegisterPage() {
  return (
    <AccountProviders>
      <RegisterClient />
    </AccountProviders>
  );
}
