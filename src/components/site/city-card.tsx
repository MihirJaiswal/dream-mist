"use client";

import { Badge } from "@/components/site/badge";
import { buttonClass } from "@/components/site/button";
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
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-[#3a3a3a]">
      <a href={edit(`visit=${city.id}`)} className="relative block aspect-[16/10] overflow-hidden bg-[#121212]" title={`Play ${city.name}`}>
        {city.thumb
          ? <img src={city.thumb} alt={`Map of ${city.name}`} loading="lazy" className="flyover pixelated h-full w-full object-cover" />
          : <div className="pixelated grid h-full w-full place-items-center bg-[url(/site/loaderbg.png)] bg-cover bg-center"><img src="/site/dreammist.png" alt="" width={48} height={48} className="pixelated" /></div>}
        <span className="absolute bottom-2.5 right-2.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-bg/80 px-3 text-[12px] font-medium opacity-0 transition-opacity group-hover:opacity-100"><Play weight="fill" size={12} /> Play</span>
      </a>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold">{city.name}</h3>
          {mine ? <Badge>Yours</Badge> : null}
        </div>
        <p className="text-[12px] text-subtle-fg">by {city.owner} · {ago(city.publishedAt)}</p>
        {city.description ? <p className="line-clamp-2 text-[13px] text-muted-fg">{city.description}</p> : null}
        {city.forkOf ? <a href={edit(`visit=${city.forkOf.id}`)} className="inline-flex items-center gap-1 text-[12px] text-subtle-fg hover:text-fg"><GitFork size={12} /> Forked from {city.forkOf.name} by {city.forkOf.owner}</a> : null}
        <div className="flex flex-wrap gap-1">{meta.map((text) => <Badge key={text}>{text}</Badge>)}</div>
        <div className="mt-auto flex items-center gap-1.5 pt-3">
          <a href={edit(`visit=${city.id}`)} className={buttonClass({ size: "sm" })}><Play weight="fill" size={13} /> Play</a>
          {mine
            ? <a href={edit(`open=${city.id}`)} className={buttonClass({ variant: "outline", size: "sm" })}><PencilSimple size={13} /> Edit</a>
            : <a href={edit(`fork=${city.id}`)} className={buttonClass({ variant: "outline", size: "sm" })} title="Copy it into your cities and build on top"><GitFork size={13} /> Fork</a>}
          <span className="ml-auto flex items-center gap-2.5 text-[12px] text-subtle-fg tabular-nums">
            <span className="inline-flex items-center gap-1" title="Plays"><Play size={12} /> {short(city.plays)}</span>
            <span className="inline-flex items-center gap-1" title="Forks"><GitFork size={12} /> {short(city.forks)}</span>
            <button onClick={toggle} aria-pressed={Boolean(city.liked)} title={city.liked ? "Unlike" : "Like"} className={cn("inline-flex items-center gap-1 transition-colors hover:text-pink-400", city.liked && "text-pink-400")}>
              <Heart size={13} weight={city.liked ? "fill" : "regular"} /> {short(city.likes)}
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}
