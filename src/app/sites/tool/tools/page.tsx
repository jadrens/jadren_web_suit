import ToolsClient from "./ToolsClient";
import { createPageMetadata } from "@tool/lib/seo";

export const metadata = createPageMetadata({
  title: "Online Developer Tools",
  description: "Browse free tools for email reminders, Base64 encoding, DNS lookup, IP information, QR code generation, colour conversion, and short links.",
  path: "/tools",
  keywords: ["developer tools", "email reminders", "online utilities", "browser tools", "network tools"],
});

export default function ToolsPage() {
  return <ToolsClient />;
}
