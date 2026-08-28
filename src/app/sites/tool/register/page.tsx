import type { Metadata } from "next";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = {
  title: "注册账户 | jadren tools",
  description: "创建 jadren tools 账户",
};

export default function RegisterPage() {
  return <RegisterClient />;
}
