"use client";

import { CityCard } from "@/components/site/city-card";
import { PixelButton } from "@/components/site/landing/pixel";
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
      <div className="text-center">
        <h2 className="font-pixel text-[30px] leading-[1.15] sm:text-[44px]"><span className="text-[#f06aa6]">Latest</span><br /><span className="text-white">towns</span></h2>
        <p className="mt-3 font-game text-[15px] text-[#c9b8f5]">Fresh from other trainers</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cities.map((city) => <CityCard key={city.id} city={city} user={user} />)}</div>
      <div className="mt-10 text-center"><PixelButton href="/explore" tone="lilac">See all towns</PixelButton></div>
    </section>
  );
}
