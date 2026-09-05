import DnsClient from "./DnsClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "DNS Lookup Tool",
  description: "Query A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, CAA, and other DNS records for any domain.",
  path: "/tools/dns",
  keywords: ["DNS lookup", "DNS record checker", "A record", "MX lookup", "TXT record lookup"],
});

export default function DnsPage() {
  return <DnsClient />;
}
