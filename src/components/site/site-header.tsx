"use client";

import { openLogin } from "@/components/login";
import { PixelButton } from "@/components/site/landing/pixel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { edit, logout, me } from "@/lib/api";
import { cn } from "@/lib/utils";
import { House, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Account menu rows: pixel text that lights up lilac */
const item =
  "rounded-none px-3 py-2.5 font-pixel text-[11px] uppercase tracking-wide text-[#c9b8f5] focus:bg-[#2a1a52] focus:text-white [&_svg]:size-4 [&_svg]:text-[#8a7bb8] focus:[&_svg]:text-white";

/** Navigation links */
const links = [
  { href: "/explore", label: "Explore" },
  { href: "/docs", label: "Docs" },
];

/** Site header: the night sky's top edge, with the pink logo and a pixel button into the editor */
export function SiteHeader() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string } | null | undefined>(undefined);
  useEffect(() => {
    me().then((account) => {
      setUser(account);
      //Signed in, but the server showed the landing page (a session that just moved to cookies): show the home instead
      if (account && location.pathname === "/" && document.querySelector("[data-landing]")) {
        router.refresh();
      }
    });
  }, [router]);
  const leave = async () => {
    await logout().catch(() => null);
    setUser(null);
    router.push("/");
    router.refresh();
  };
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-[#2d1a52] bg-[#130f2e] backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-4 sm:gap-8 md:px-8">
        <Link href="/" aria-label="DreamMist home" className="flex shrink-0 items-center gap-2.5">
          <img src="/site/dreammist.png" alt="" width={28} height={28} className="pixelated" />
          <span className="hidden font-pixel text-[17px] text-[#f06aa6] [text-shadow:2px_2px_0_#4a1640] sm:inline">DreamMist</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          {links.map(({ href, label }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative px-2.5 py-2 font-pixel text-[12px] uppercase tracking-wide transition-colors",
                  active ? "text-white" : "text-[#c9b8f5] hover:text-white",
                )}
              >
                {label}
                {active ? <span className="absolute inset-x-2.5 -bottom-[3px] h-[3px] bg-[#f06aa6]" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              title={`Signed in as ${user.username}`}
              aria-label="Account menu"
              className="stepped grid size-9 shrink-0 place-items-center bg-[#b9a6ff] font-pixel text-[13px] text-[#1c1240] outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#f06aa6]"
            >
              {user.username[0].toUpperCase()}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="stepped w-56 rounded-none border-0 bg-[#1d1038] p-[3px] text-[#c9b8f5] shadow-[inset_0_0_0_3px_#3f2c74,0_6px_0_rgb(0_0_0/0.35)]"
            >
              <DropdownMenuLabel className="px-4 pb-3 pt-3.5 font-normal">
                <span className="block font-game text-[13px] text-[#8a7bb8]">Signed in as</span>
                <span className="mt-1 block truncate font-pixel text-[14px] text-white">{user.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="mx-[3px] my-0 h-[3px] bg-[#3f2c74]" />
              <div className="p-1.5">
                <DropdownMenuItem asChild className={item}>
                  <Link href="/">
                    <House />
                    Your games
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void leave()} className={cn(item, "focus:bg-[#f06aa6] focus:text-[#2a0a1e] focus:[&_svg]:text-[#2a0a1e]")}>
                  <SignOut />
                  Log out
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : user === null ? (
          <button onClick={() => openLogin()} className="shrink-0 font-pixel text-[12px] uppercase tracking-wide text-[#c9b8f5] hover:text-white">
            Log in
          </button>
        ) : null}
        <PixelButton href={edit()} small className="shrink-0">
          <span className="sm:hidden">Editor</span>
          <span className="hidden sm:inline">Open editor</span>
        </PixelButton>
      </div>
    </header>
  );
}
