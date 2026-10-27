"use client";

import { buttonClass } from "@/components/site/button";
import { edit, me } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Navigation links */
const links: { href: string; label: string; plain?: boolean }[] = [
  { href: "/explore", label: "Explore" },
  { href: "/docs", label: "Docs" },
];

/** Site header (spans the whole window on every page) */
export function SiteHeader() {
  const path = usePathname();
  const [user, setUser] = useState<{ username: string } | null | undefined>(undefined);
  useEffect(() => {
    me().then(setUser);
  }, []);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-6 md:px-6">
        <Link href="/" aria-label="DreamMist home" className="flex shrink-0 items-center gap-2 text-fg">
          <img src="/site/dreammist.png" alt="" width={24} height={24} className="pixelated" />
          <span className="hidden font-pixel text-[14px] sm:inline">DreamMist</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-[13px] font-medium">
          {links.map(({ href, label, plain }) => {
            const active = path.startsWith(href);
            const className = cn("rounded-md px-2.5 py-1.5 transition-colors", active ? "bg-muted text-fg" : "text-muted-fg hover:text-fg");
            return plain ? <a key={href} href={href} className={cn(className, "hidden sm:inline")}>{label}</a> : <Link key={href} href={href} className={className}>{label}</Link>;
          })}
        </nav>
        {user
          ? <a href={edit()} title={`Signed in as ${user.username}`} className="grid size-8 shrink-0 place-items-center rounded-full bg-fg text-[12px] font-semibold text-bg">{user.username[0].toUpperCase()}</a>
          : user === null
          ? <a href={edit()} className={buttonClass({ variant: "ghost", size: "sm" })}>Log in</a>
          : null}
        <a href={edit()} className={cn(buttonClass({ size: "sm" }), "shrink-0")}><span className="sm:hidden">Editor</span><span className="hidden sm:inline">Open editor</span></a>
      </div>
    </header>
  );
}
