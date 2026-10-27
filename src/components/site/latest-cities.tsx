"use client";

import { CityCard } from "@/components/site/city-card";
import { ButtonLink } from "@/components/site/button";
import { type Card, explore, me } from "@/lib/api";
import { useEffect, useState } from "react";

/** Newest published cities (hidden when there are none or the server is unreachable) */
export function LatestCities() {
  const [cities, setCities] = useState<Card[]>([]);
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    explore().then((cards) => setCities(cards.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 3))).catch(() => setCities([]));
    me().then((user) => setUser(user?.username ?? null));
  }, []);
  if (!cities.length) {
    return null;
  }
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-6 py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-pixel text-[12px] uppercase tracking-wider text-muted-fg">Explore</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Fresh from other trainers</h2>
        </div>
        <ButtonLink href="/explore" variant="outline" size="sm">See all cities</ButtonLink>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cities.map((city) => <CityCard key={city.id} city={city} user={user} />)}</div>
    </section>
  );
}
