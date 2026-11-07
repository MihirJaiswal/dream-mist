import { siteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/** robots.txt: the site and docs are for search engines, the editor and the API aren't */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/editor", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
