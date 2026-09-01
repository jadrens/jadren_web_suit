import IpClient from "./IpClient";
import { createPageMetadata } from "@shared/libs/seo";

export const metadata = createPageMetadata({
  title: "What Is My IP Address?",
  description: "Check your public IPv4 or IPv6 address and view location, ISP, ASN, reverse DNS, and network details.",
  path: "/tools/ip",
  keywords: ["what is my IP", "IP address lookup", "public IP checker", "IP geolocation", "ASN lookup"],
});

export default function IpPage() {
  return <IpClient />;
}
