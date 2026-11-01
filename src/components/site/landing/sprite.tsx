import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Gen 3 sprite, the same ones the game uses */
export const sprite = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/ruby-sapphire/${id}.png`;

/** Animated Gen 5 sprite (natural size in pixels, drawn at `scale`) */
export function Anim({
  id,
  w,
  h,
  scale = 3,
  back = false,
  className,
}: {
  id: number;
  w: number;
  h: number;
  scale?: number;
  back?: boolean;
  className?: string;
}) {
  return <img src={`/site/sprites/anim-${back ? "back-" : ""}${id}.gif`} alt="" width={w * scale} height={h * scale} className={cn("pixelated", className)} />;
}

/** HP bar over a Pokémon on the stage */
export function Hp({ name, level, value }: { name: string; level: number; value: number }) {
  return (
    <div className="stepped w-32 bg-[#1d1038] px-2 py-1.5 font-game text-[12px] text-white sm:w-36">
      <div className="flex justify-between">
        <span>{name}</span>
        <span>Lv{level}</span>
      </div>
      <div className="mt-1 h-2 bg-[#0b0616] p-px">
        <div className="h-full" style={{ width: `${value}%`, background: value > 50 ? "#5ee07a" : value > 20 ? "#f8c030" : "#f05038" }} />
      </div>
    </div>
  );
}

/** Two-line section heading: a small lead-in, then the title with one word in pink */
export function Heading({ lead, children, className }: { lead?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      {lead ? <p className="font-game text-[15px] text-[#c9b8f5]">{lead}</p> : null}
      <h2 className="mt-2 text-balance font-pixel text-[30px] leading-[1.15] text-white sm:text-[44px]">{children}</h2>
    </div>
  );
}

/** Pink word in a heading */
export function Pink({ children }: { children: ReactNode }) {
  return <span className="text-[#f06aa6]">{children}</span>;
}
