"use client";

import { Badge } from "@/components/site/badge";
import { PixelButton } from "@/components/site/landing/pixel";
import { type Card, edit, like } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GitFork, Heart, PencilSimple, Play } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

/** Relative date */
function ago(time: number) {
  const days = Math.floor((Date.now() - time) / 86_400_000);
  return days < 1 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(time).toLocaleDateString();
}

/** Compact number */
function short(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${value}`;
}

/** Published city card */
export function CityCard({ city: initial, user }: { city: Card; user?: string | null }) {
  const [city, setCity] = useState(initial);
  const mine = city.mine ?? (Boolean(user) && city.owner === user);
  const meta = [`${city.width}×${city.height}`, city.interiors ? `${city.interiors} interior${city.interiors > 1 ? "s" : ""}` : "", city.story ? `${city.story}-step story` : ""].filter(Boolean);
  const toggle = async () => {
    if (!user) {
      return toast.warning("Log in to like cities", { description: "Likes belong to your account.", action: { label: "Log in", onClick: () => location.assign(edit()) } });
    }
    try {
      const result = await like(city.id);
      setCity({ ...city, liked: result.liked, likes: result.likes });
    } catch (error) {
      toast.error("Couldn't update your like", { description: (error as Error).message });
    }
  };
  return (
    <article className="group stepped flex min-w-0 flex-col bg-[#3f2c74] p-[3px] transition-colors hover:bg-[#b9a6ff]">
      <div className="stepped flex flex-1 flex-col bg-[#1d1038]">
      <a href={edit(`visit=${city.id}`)} className="relative block aspect-[16/10] overflow-hidden bg-[#0d0720]" title={`Play ${city.name}`}>
        {city.thumb
          ? <img src={city.thumb} alt={`Map of ${city.name}`} loading="lazy" className="flyover pixelated h-full w-full object-cover" />
          : <div className="pixelated grid h-full w-full place-items-center bg-[url(/site/loaderbg.png)] bg-cover bg-center"><img src="/site/dreammist.png" alt="" width={48} height={48} className="pixelated" /></div>}
        <span className="absolute bottom-2.5 right-2.5 inline-flex h-7 items-center gap-1.5 bg-[#f06aa6] px-3 font-pixel text-[11px] uppercase text-[#2a0a1e] opacity-0 transition-opacity group-hover:opacity-100"><Play weight="fill" size={11} /> Play</span>
      </a>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-pixel text-[14px] text-white">{city.name}</h3>
          {mine ? <Badge className="bg-[#f06aa6] text-[#2a0a1e]">Yours</Badge> : null}
        </div>
        <p className="font-game text-[13px] text-[#8a7bb8]">by {city.owner} · {ago(city.publishedAt)}</p>
        {city.description ? <p className="line-clamp-2 font-game text-[14px] text-[#c9b8f5]">{city.description}</p> : null}
        {city.forkOf ? <a href={edit(`visit=${city.forkOf.id}`)} className="inline-flex items-center gap-1 font-game text-[13px] text-[#8a7bb8] hover:text-white"><GitFork size={12} /> Forked from {city.forkOf.name} by {city.forkOf.owner}</a> : null}
        <div className="flex flex-wrap gap-1">{meta.map((text) => <Badge key={text}>{text}</Badge>)}</div>
        <div className="mt-auto flex items-center gap-2.5 pt-4">
          <PixelButton href={edit(`visit=${city.id}`)} small><span className="inline-flex items-center gap-1.5"><Play weight="fill" size={11} /> Play</span></PixelButton>
          {mine
            ? <PixelButton href={edit(`open=${city.id}`)} tone="lilac" small><span className="inline-flex items-center gap-1.5"><PencilSimple size={11} /> Edit</span></PixelButton>
            : <PixelButton href={edit(`fork=${city.id}`)} tone="lilac" small><span className="inline-flex items-center gap-1.5" title="Copy it into your cities and build on top"><GitFork size={11} /> Fork</span></PixelButton>}
          <span className="ml-auto flex items-center gap-2.5 font-game text-[13px] text-[#8a7bb8] tabular-nums">
            <span className="inline-flex items-center gap-1" title="Plays"><Play size={12} /> {short(city.plays)}</span>
            <span className="inline-flex items-center gap-1" title="Forks"><GitFork size={12} /> {short(city.forks)}</span>
            <button onClick={toggle} aria-pressed={Boolean(city.liked)} title={city.liked ? "Unlike" : "Like"} className={cn("inline-flex items-center gap-1 transition-colors hover:text-[#f06aa6]", city.liked && "text-[#f06aa6]")}>
              <Heart size={13} weight={city.liked ? "fill" : "regular"} /> {short(city.likes)}
            </button>
          </span>
        </div>
      </div>
      </div>
    </article>
  );
}
