import type { Metadata } from "next";
import UserStatusClient from "./UserStatusClient";

export const metadata: Metadata = {
  title: "Account Status | jadren tools",
  description: "View account status and manage the current session",
};

export default function UserStatusPage() {
  return <UserStatusClient />;
}

