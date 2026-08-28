import DnsLeakClient from "./DnsLeakClient";
import { createPageMetadata } from "@tool/lib/seo";

export const metadata = createPageMetadata({
  title: "DNS Leak Test",
  description: "Run a browser-based DNS leak test to check whether your DNS queries are reaching multiple resolver providers.",
  path: "/tools/dns-leak",
  keywords: ["DNS leak test", "DNS privacy test", "DNS resolver test", "check DNS leak"],
});

export default function DnsLeakPage() {
  return <DnsLeakClient />;
}
