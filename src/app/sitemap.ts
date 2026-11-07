import { siteUrl } from "@/lib/site";
import { source } from "@/lib/source";
import type { MetadataRoute } from "next";

/** sitemap.xml: the landing page, Explore and every docs page */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/explore`, changeFrequency: "daily", priority: 0.8 },
    ...source.getPages().map(({ url }) => ({ url: `${siteUrl}${url}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
