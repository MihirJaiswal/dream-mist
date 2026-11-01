"use client";

import { PixelButton } from "@/components/site/landing/pixel";
import { edit, me } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Navigation links */
const links = [
  { href: "/explore", label: "Explore" },
  { href: "/docs", label: "Docs" },
];

/** Site header: the night sky's top edge, with the pink logo and a pixel button into the editor */
export function SiteHeader() {
  const path = usePathname();
  const [user, setUser] = useState<{ username: string } | null | undefined>(undefined);
  useEffect(() => {
    me().then(setUser);
  }, []);
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-[#2d1a52] bg-[#0d0720]/90 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-4 sm:gap-8 md:px-8">
        <Link href="/" aria-label="DreamMist home" className="flex shrink-0 items-center gap-2.5">
          <img src="/site/dreammist.png" alt="" width={28} height={28} className="pixelated" />
          <span className="hidden font-pixel text-[17px] text-[#f06aa6] [text-shadow:2px_2px_0_#4a1640] sm:inline">DreamMist</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          {links.map(({ href, label }) => {
            const active = path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("relative px-2.5 py-2 font-pixel text-[12px] uppercase tracking-wide transition-colors", active ? "text-white" : "text-[#c9b8f5] hover:text-white")}>
                {label}
                {active ? <span className="absolute inset-x-2.5 -bottom-[3px] h-[3px] bg-[#f06aa6]" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>
        {user
          ? <a href={edit()} title={`Signed in as ${user.username}`} className="stepped grid size-9 shrink-0 place-items-center bg-[#b9a6ff] font-pixel text-[13px] text-[#1c1240]">{user.username[0].toUpperCase()}</a>
          : user === null
          ? <a href={edit()} className="hidden shrink-0 font-pixel text-[12px] uppercase tracking-wide text-[#c9b8f5] hover:text-white sm:inline">Log in</a>
          : null}
        <PixelButton href={edit()} small className="shrink-0"><span className="sm:hidden">Editor</span><span className="hidden sm:inline">Open editor</span></PixelButton>
      </div>
    </header>
  );
}
