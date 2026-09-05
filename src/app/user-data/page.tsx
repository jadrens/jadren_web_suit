import type { Metadata } from "next";
import UserDataClient from "./UserDataClient";

export const metadata: Metadata = { title: "User Data | jadren tools", description: "Manage account-owned vocabulary learning data." };
export default function UserDataPage() { return <UserDataClient />; }
