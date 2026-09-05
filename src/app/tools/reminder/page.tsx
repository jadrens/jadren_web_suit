import ReminderClient from "./ReminderClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "Email Reminder",
  description: "Schedule one-time or repeating email reminders with an auditable delivery history.",
  path: "/tools/reminder",
  keywords: ["email reminder", "repeating reminder", "scheduled email", "reminder audit"],
});

export default function ReminderPage() {
  return <ReminderClient />;
}
