"use client";

import { CityCard } from "@/components/site/city-card";
import { Input } from "@/components/site/input";
import { Cloud, PixelButton } from "@/components/site/landing/pixel";
import { type Card, edit, explore, me } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

/** Sort orders */
const sorts = [
  { key: "new", label: "Newest", by: (card: Card) => card.publishedAt },
  { key: "plays", label: "Most played", by: (card: Card) => card.plays },
  { key: "likes", label: "Most liked", by: (card: Card) => card.likes },
  { key: "forks", label: "Most forked", by: (card: Card) => card.forks },
] as const;

/** Twinkling stars over the header (percent positions, delay in seconds) */
const stars = [[8, 18, 0], [20, 60, 1.2], [33, 14, 0.6], [62, 22, 1.8], [74, 64, 0.3], [86, 16, 1.5], [93, 48, 0.9], [47, 70, 2.1]];

/** Explore gallery */
export function ExploreGallery() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [sort, setSort] = useState<typeof sorts[number]["key"]>("new");
  const [query, setQuery] = useState("");
  useEffect(() => {
    explore().then(setCards).catch((error: Error) => (setError(error.message), setCards([])));
    me().then((user) => setUser(user?.username ?? null));
  }, []);
  const shown = useMemo(() => {
    const order = sorts.find(({ key }) => key === sort)!;
    const search = query.trim().toLowerCase();
    return (cards ?? []).filter(({ name, owner, description }) => !search || `${name} ${owner} ${description}`.toLowerCase().includes(search)).sort((a, b) => order.by(b) - order.by(a));
  }, [cards, sort, query]);
  return (
    <div className="relative">
      {/* Night sky header */}
      <section className="relative overflow-hidden bg-[linear-gradient(#0d0720_0%,#1c0f3a_100%)] px-4 pb-14 pt-14 text-center">
        {stars.map(([x, y, delay]) => <span key={`${x}-${y}`} className="twinkle absolute size-1 bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }} aria-hidden="true" />)}
        <Cloud className="absolute -left-16 top-1 w-44 opacity-80 sm:-left-12 sm:top-10 sm:w-96" />
        <Cloud flip className="absolute -right-12 bottom-6 w-60 opacity-70 sm:w-80" />
        <h1 className="relative font-pixel text-[32px] leading-[1.15] sm:text-[48px]"><span className="text-[#f06aa6]">Explore</span><br /><span className="text-white">towns</span></h1>
        <p className="relative mx-auto mt-4 max-w-[52ch] font-game text-[16px] leading-relaxed text-[#c9b8f5]">Play towns made by other trainers, or fork one and build your own version on top.</p>
        <div className="relative mt-7 flex justify-center"><PixelButton href={edit()}><span className="inline-flex items-center gap-2"><Plus size={13} weight="bold" /> Build a town</span></PixelButton></div>
      </section>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search towns or creators" aria-label="Search towns" className="w-80 max-w-full" />
          <div role="tablist" aria-label="Sort" className="flex flex-wrap gap-2">
            {sorts.map(({ key, label }) => (
              <button key={key} role="tab" aria-selected={sort === key} onClick={() => setSort(key)} className={cn("stepped h-11 px-4 font-pixel text-[11px] uppercase tracking-wide transition-colors", sort === key ? "bg-[#f06aa6] text-[#2a0a1e]" : "bg-[#1d1038] text-[#c9b8f5] shadow-[inset_0_0_0_3px_#3f2c74] hover:text-white")}>{label}</button>
            ))}
          </div>
          <span className="ml-auto font-game text-[14px] text-[#8a7bb8] tabular-nums">{cards ? `${shown.length} town${shown.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {!cards
            ? Array.from({ length: 6 }, (_, i) => <div key={i} className="stepped h-80 animate-pulse bg-[#1d1038]" />)
            : error || !shown.length
            ? (
              <div className="stepped col-span-full flex flex-col items-center gap-3 bg-[#1d1038] px-4 py-16 text-center shadow-[inset_0_0_0_3px_#3f2c74]">
                <img src="/site/sprites/anim-517.gif" alt="" width={45} height={43} className="pixelated float h-auto w-20" />
                <b className="font-pixel text-[16px] text-white">{error ? "Explore isn't available" : query ? "No town matches your search" : "No towns published yet"}</b>
                <p className="max-w-[46ch] font-game text-[15px] text-[#c9b8f5]">{error || (query ? "Try another name or creator." : "Build a town, then press Publish in the editor to share it here.")}</p>
                {!error && !query ? <PixelButton href={edit()} small className="mt-3"><span className="inline-flex items-center gap-1.5"><Plus size={11} weight="bold" /> Build a town</span></PixelButton> : null}
              </div>
            )
            : shown.map((city) => <CityCard key={city.id} city={city} user={user} />)}
        </section>
      </div>
    </div>
  );
}
