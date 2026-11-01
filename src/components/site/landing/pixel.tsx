import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

/** Pixel cloud picture (mirrored for variety) */
export function Cloud({ flip = false, className }: { flip?: boolean; className?: string }) {
  return (
    <img
      src="/site/cloud.avif"
      alt=""
      aria-hidden="true"
      width={2172}
      height={724}
      className={cn("pixelated pointer-events-none h-auto", flip && "-scale-x-100", className)}
    />
  );
}

/** White label with a hard pixel outline */
export function Sticker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("sticker", className)}>
      <span>{children}</span>
    </span>
  );
}

/** Chunky pixel button (links to the editor load fresh, so its game engine starts clean) */
export function PixelButton({
  href,
  children,
  tone = "pink",
  small = false,
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: "pink" | "lilac" | "wood";
  small?: boolean;
  className?: string;
}) {
  const content = <span>{children}</span>;
  const props = { className: cn("pixel-button", `pixel-button-${tone}`, small && "pixel-button-small", className) };
  return href.startsWith("/editor") ? (
    <a href={href} {...props}>
      {content}
    </a>
  ) : (
    <Link href={href} {...props}>
      {content}
    </Link>
  );
}

/** Stone ledge the Pokémon stand on */
export function Ledge({ className }: { className?: string }) {
  return <div className={cn("pixel-ledge", className)} aria-hidden="true" />;
}
