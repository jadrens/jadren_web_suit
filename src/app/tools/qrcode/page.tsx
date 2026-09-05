import QrcodeClient from "./QrcodeClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "QR Code Generator",
  description: "Generate and download a QR code from text, a URL, or any other content directly in your browser.",
  path: "/tools/qrcode",
  keywords: ["QR code generator", "create QR code", "URL QR code", "download QR code PNG"],
});

export default function QrcodePage() {
  return <QrcodeClient />;
}
