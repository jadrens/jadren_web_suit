import type { Metadata } from "next";
import CaptchaTestClient from "./CaptchaTestClient";

export const metadata: Metadata = {
  title: "验证码测试",
  description: "试用 jadren 账户验证码",
  robots: { index: false, follow: false },
};

export default function CaptchaTestPage() {
  return <CaptchaTestClient />;
}
