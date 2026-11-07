"use client";

import { CityCard } from "@/components/site/city-card";
import { PixelButton } from "@/components/site/landing/pixel";
import { type Card, edit, explore, me, myCities, type Playing, playing } from "@/lib/api";
import { Compass, Plus } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useState } from "react";

/** Before paint: a saved Supabase session shows the signed-in home instead of the landing page (no flash of the landing for players) */
export const signedInProbe = `try{if(Object.keys(localStorage).some(function(k){return /^sb-.+-auth-token$/.test(k)}))document.documentElement.dataset.signedIn=""}catch(e){}`;

/** Show the landing page again (signed out, expired session, or online features unreachable) */
function landing() {
  delete document.documentElement.dataset.signedIn;
}

/** Signed-in home, like a dashboard: the games you're playing and your cities (hidden by CSS for visitors) */
export function SignedInHome() {
  const [user, setUser] = useState<string | null>(null);
  const [cities, setCities] = useState<Card[] | null>(null);
  const [games, setGames] = useState<Playing[] | null>(null);
  useEffect(() => {
    me().then(async (account) => {
      if (!account) {
        return landing();
      }
      document.documentElement.dataset.signedIn = "";
      setUser(account.username);
      const [mine, published] = await Promise.all([myCities().catch(() => []), explore().catch(() => [])]);
      setCities(mine);
      //Your own cities are already below
      const own = new Set(mine.map(({ id }) => id));
      setGames(await playing(published.filter(({ id }) => !own.has(id))).catch(() => []));
    });
  }, []);
  return (
    <div className="signed-in-home mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-game text-[15px] text-[#8a7bb8]">Welcome back,</p>
          <h1 className="truncate font-pixel text-[28px] leading-[1.15] text-white sm:text-[40px]">
            {user ?? <span className="inline-block h-[1em] w-48 animate-pulse bg-[#1d1038] align-middle" />}
          </h1>
        </div>
        <PixelButton href="/explore" tone="lilac">
          <span className="inline-flex items-center gap-2">
            <Compass size={13} weight="bold" /> Explore
          </span>
        </PixelButton>
        <PixelButton href={edit()}>
          <span className="inline-flex items-center gap-2">
            <Plus size={13} weight="bold" /> Build a town
          </span>
        </PixelButton>
      </div>

      <Shelf
        title="Continue playing"
        hint="Games by other trainers you started, most recent first"
        cards={games?.map(({ city, badges, steps }) => (
          <CityCard key={city.id} city={city} user={user} progress={progress(badges, steps, city.story)} />
        ))}
        empty={
          <Empty title="No games in progress" text="Games you play from Explore show up here, so you can jump back in.">
            <PixelButton href="/explore" small tone="lilac">
              <span className="inline-flex items-center gap-1.5">
                <Compass size={11} weight="bold" /> Find a game
              </span>
            </PixelButton>
          </Empty>
        }
      />

      <Shelf
        title="Your cities"
        hint="Cities you own or build on, last edited first"
        cards={cities?.map((city) => (
          <CityCard key={city.id} city={city} user={user} />
        ))}
        empty={
          <Empty title="No cities yet" text="Build a town in the editor and save it to your account to see it here.">
            <PixelButton href={edit()} small>
              <span className="inline-flex items-center gap-1.5">
                <Plus size={11} weight="bold" /> Build a town
              </span>
            </PixelButton>
          </Empty>
        }
      />
    </div>
  );
}

/** "2 badges · story 3/5" */
function progress(badges: number, steps: number, story: number) {
  return (
    [badges ? `${badges} badge${badges > 1 ? "s" : ""}` : "", story ? `story ${Math.min(steps, story)}/${story}` : ""].filter(Boolean).join(" · ") || "Started"
  );
}

/** A titled row of cards (pulsing placeholders while loading) */
function Shelf({ title, hint, cards, empty }: { title: string; hint: string; cards?: ReactNode[]; empty: ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="font-pixel text-[18px] text-[#f06aa6] sm:text-[22px]">{title}</h2>
      <p className="mt-1.5 font-game text-[14px] text-[#8a7bb8]">{hint}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!cards ? Array.from({ length: 3 }, (_, i) => <div key={i} className="stepped h-80 animate-pulse bg-[#1d1038]" />) : cards.length ? cards : empty}
      </div>
    </section>
  );
}

/** Empty shelf */
function Empty({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="stepped col-span-full flex flex-col items-center gap-3 bg-[#1d1038] px-4 py-12 text-center shadow-[inset_0_0_0_3px_#3f2c74]">
      <img src="/site/sprites/anim-517.gif" alt="" width={45} height={43} className="pixelated float h-auto w-16" />
      <b className="font-pixel text-[15px] text-white">{title}</b>
      <p className="max-w-[46ch] font-game text-[15px] text-[#c9b8f5]">{text}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
