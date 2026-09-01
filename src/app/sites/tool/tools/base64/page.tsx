import Base64Client from "./Base64Client";
import { createPageMetadata } from "@shared/libs/seo";

export const metadata = createPageMetadata({
  title: "Base64 Encoder and Decoder",
  description: "Encode text to Base64 or decode Base64 strings in your browser with instant results and no upload required.",
  path: "/tools/base64",
  keywords: ["Base64 encoder", "Base64 decoder", "encode text", "decode Base64"],
});

export default function Base64Page() {
  return <Base64Client />;
}
