import { MetadataRoute } from "next";
import SITE_CONFIG from "@tool/var/config";

const BASE_URL = SITE_CONFIG.baseUrl;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
