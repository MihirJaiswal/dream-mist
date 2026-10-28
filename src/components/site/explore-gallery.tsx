"use client";

import { CityCard } from "@/components/site/city-card";
import { ButtonLink } from "@/components/site/button";
import { Input } from "@/components/site/input";
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
    <div className="mx-auto max-w-7xl px-4 md:px-6 pb-20 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight">Explore cities</h1>
          <p className="mt-2 max-w-[60ch] text-muted-fg">Play towns made by other trainers, or fork one and build your own version on top.</p>
        </div>
        <ButtonLink href={edit()}><Plus size={14} /> Build a city</ButtonLink>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cities or creators" aria-label="Search cities" className="w-72 max-w-full" />
        <div role="tablist" className="inline-flex gap-0.5 rounded-lg border border-line bg-muted p-[3px]">
          {sorts.map(({ key, label }) => (
            <button key={key} role="tab" aria-selected={sort === key} onClick={() => setSort(key)} className={cn("h-7 rounded-md px-3 text-[13px] font-medium transition-colors", sort === key ? "bg-bg text-fg shadow-sm" : "text-muted-fg hover:text-fg")}>{label}</button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-subtle-fg tabular-nums">{cards ? `${shown.length} cit${shown.length === 1 ? "y" : "ies"}` : ""}</span>
      </div>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!cards
          ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-80 animate-pulse rounded-xl border border-line bg-surface" />)
          : error || !shown.length
          ? (
            <div className="col-span-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-16 text-center">
              <b>{error ? "Explore isn't available" : query ? "No city matches your search" : "No cities published yet"}</b>
              <p className="text-muted-fg">{error || (query ? "Try another name or creator." : "Build a town, then press Publish in the editor to share it here.")}</p>
              {!error && !query ? <ButtonLink href={edit()} size="sm" className="mt-2"><Plus size={14} /> Build a city</ButtonLink> : null}
            </div>
          )
          : shown.map((city) => <CityCard key={city.id} city={city} user={user} />)}
      </section>
    </div>
  );
}
