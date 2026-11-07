"use client";

import { openLogin } from "@/components/login";
import { PixelButton } from "@/components/site/landing/pixel";
import { type Card, like, me } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GitFork, Heart, LinkSimple, PencilSimple, Play } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** A game page's buttons: play it, fork it (or edit it when it's yours), like it and copy its link */
export function GameActions({ city }: { city: Card }) {
  const [user, setUser] = useState<string | null>(null);
  const [liked, setLiked] = useState({ liked: false, likes: city.likes });
  useEffect(() => {
    me().then((account) => setUser(account?.username ?? null));
  }, []);
  const mine = Boolean(user) && city.owner === user;
  const toggle = async () => {
    if (!user) {
      return openLogin("like");
    }
    try {
      setLiked(await like(city.id));
    } catch (error) {
      toast.error("Couldn't update your like", { description: (error as Error).message });
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(location.href).catch(() => null);
    toast.success("Link copied", { description: "Anyone with it can play this game" });
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <PixelButton href={`/play/${city.id}`}>
        <span className="inline-flex items-center gap-2">
          <Play weight="fill" size={13} /> Play
        </span>
      </PixelButton>
      {mine ? (
        <PixelButton href={`/editor#open=${city.id}`} tone="lilac">
          <span className="inline-flex items-center gap-2">
            <PencilSimple size={13} /> Edit
          </span>
        </PixelButton>
      ) : (
        <PixelButton href={`/editor#${user ? "fork" : "remix"}=${city.id}`} tone="lilac">
          <span className="inline-flex items-center gap-2" title="Copy it into your cities and build on top">
            <GitFork size={13} /> Fork
          </span>
        </PixelButton>
      )}
      <button
        onClick={toggle}
        aria-pressed={liked.liked}
        className={cn(
          "stepped inline-flex h-11 items-center gap-2 bg-[#1d1038] px-4 font-pixel text-[11px] uppercase text-[#c9b8f5] shadow-[inset_0_0_0_3px_#3f2c74] hover:text-white",
          liked.liked && "text-[#f06aa6]",
        )}
      >
        <Heart size={14} weight={liked.liked ? "fill" : "regular"} /> {liked.likes}
      </button>
      <button
        onClick={copy}
        className="stepped inline-flex h-11 items-center gap-2 bg-[#1d1038] px-4 font-pixel text-[11px] uppercase text-[#c9b8f5] shadow-[inset_0_0_0_3px_#3f2c74] hover:text-white"
      >
        <LinkSimple size={14} /> Copy link
      </button>
    </div>
  );
}
