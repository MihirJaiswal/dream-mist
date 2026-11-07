import type { Metadata } from "next";

/** The site's public address (sitemap, robots.txt, canonical links, link previews): dreammist.games, unless NEXT_PUBLIC_SITE_URL says otherwise */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://dreammist.games" : "http://localhost:3000")
).replace(/\/$/, "");

export const siteName = "DreamMist";
export const siteTitle = "DreamMist: make your own Pokémon game";
export const siteDescription =
  "Make your own Pokémon game in the browser: real Gen 3 tiles, towns and routes, a story, trainers, gyms and battles. Share it with friends to play, like and fork.";
export const repoUrl = "https://github.com/MihirJaiswal/dream-mist";

/**
 * A page's title, description, canonical address and link previews.
 * Next replaces a parent's openGraph and twitter objects instead of merging them (the picture from app/opengraph-image.tsx included),
 * so every page sets them whole here
 */
export function pageMetadata({ title, description, path }: { title?: string; description: string; path: string }): Metadata {
  const full = title ? `${title} | ${siteName}` : siteTitle;
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: "DreamMist: build your own Pokémon game, free in your browser" };
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName, locale: "en_US", url: path, title: full, description, images: [image] },
    twitter: { card: "summary_large_image", title: full, description, images: [image] },
  };
}
