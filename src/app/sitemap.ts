import { publishedGames } from "@/lib/games";
import { siteUrl } from "@/lib/site";
import { source } from "@/lib/source";
import type { MetadataRoute } from "next";

/** Rebuilt at most hourly, so newly published games show up */
export const revalidate = 3600;

/** sitemap.xml: the landing page, Explore, every published game's page and every docs page */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const games = await publishedGames();
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/explore`, changeFrequency: "daily", priority: 0.8 },
    ...games.map(({ id, updated }) => ({ url: `${siteUrl}/g/${id}`, lastModified: new Date(updated), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...source.getPages().map(({ url }) => ({ url: `${siteUrl}${url}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
