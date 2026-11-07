import { Badge } from "@/components/site/badge";
import { GameActions } from "@/components/site/game-actions";
import { gameCard } from "@/lib/games";
import { siteName, siteUrl } from "@/lib/site";
import { GitFork, Play } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Its name, description and map picture, for search results and link previews in chats */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const city = await gameCard(id);
  if (!city) {
    return { title: "Game not found", robots: { index: false } };
  }
  const title = `${city.name} by ${city.owner}`;
  const description = city.description || `A Pokémon game made with ${siteName}: play ${city.name} free in your browser, or fork it to build your own version.`;
  const images = city.thumb ? [{ url: city.thumb, alt: `Map of ${city.name}` }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/g/${id}` },
    //Only games shared on Explore are listed in search; unpublished ones still preview in chats
    robots: { index: Boolean(city.published), follow: true },
    openGraph: { type: "website", siteName, url: `/g/${id}`, title: `${title} | ${siteName}`, description, ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title: `${title} | ${siteName}`, description, ...(images ? { images } : {}) },
  };
}

/** A game's page: its map, who made it, what's in it, and buttons to play or fork it */
export default async function GamePage({ params }: Props) {
  const { id } = await params;
  const city = await gameCard(id);
  if (!city) {
    notFound();
  }
  const facts = [
    `${city.width}×${city.height} map`,
    city.interiors ? `${city.interiors} interior${city.interiors > 1 ? "s" : ""}` : "",
    city.story ? `${city.story}-step story` : "",
  ].filter(Boolean);
  const structured = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: city.name,
    url: `${siteUrl}/g/${city.id}`,
    description: city.description || undefined,
    image: city.thumb || undefined,
    author: { "@type": "Person", name: city.owner },
    gamePlatform: "Web browser",
    playMode: "SinglePlayer",
    interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/PlayAction", userInteractionCount: city.plays },
  };
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <nav className="font-game text-[14px] text-[#8a7bb8]">
        <Link href="/explore" className="hover:text-white">
          Explore
        </Link>{" "}
        / <span className="text-[#c9b8f5]">{city.name}</span>
      </nav>
      <div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-start">
        <a href={`/play/${city.id}`} className="group stepped block bg-[#3f2c74] p-[3px] hover:bg-[#b9a6ff]" title={`Play ${city.name}`}>
          <div className="stepped relative aspect-[16/10] overflow-hidden bg-[#0d0720]">
            {city.thumb ? (
              <img src={city.thumb} alt={`Map of ${city.name}`} className="flyover pixelated h-full w-full object-cover" />
            ) : (
              <div className="pixelated grid h-full w-full place-items-center bg-[url(/site/loaderbg.png)] bg-cover bg-center">
                <img src="/site/dreammist.png" alt="" width={64} height={64} className="pixelated" />
              </div>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
              <span className="inline-flex h-12 items-center gap-2 bg-[#f06aa6] px-5 font-pixel text-[13px] uppercase text-[#2a0a1e] opacity-0 transition-opacity group-hover:opacity-100">
                <Play weight="fill" size={14} /> Play
              </span>
            </span>
          </div>
        </a>
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h1 className="font-pixel text-[28px] leading-[1.15] text-white sm:text-[36px]">{city.name}</h1>
            <p className="mt-2 font-game text-[16px] text-[#8a7bb8]">by {city.owner}</p>
          </div>
          {city.description ? <p className="font-game text-[17px] leading-relaxed text-[#c9b8f5]">{city.description}</p> : null}
          {city.forkOf ? (
            <Link href={`/g/${city.forkOf.id}`} className="inline-flex items-center gap-1.5 font-game text-[14px] text-[#8a7bb8] hover:text-white">
              <GitFork size={13} /> Forked from {city.forkOf.name} by {city.forkOf.owner}
            </Link>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <Badge key={fact}>{fact}</Badge>
            ))}
            <Badge>
              {city.plays} play{city.plays === 1 ? "" : "s"}
            </Badge>
            <Badge>
              {city.forks} fork{city.forks === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="mt-2">
            <GameActions city={city} />
          </div>
        </div>
      </div>
    </div>
  );
}
