import type { ReactNode } from "react";
import { Heading, Pink, sprite } from "./sprite";

/** One thing from the GBA games: a little screen drawn with the game's own sprites, a name and a line about it */
function Tile({ accent, title, screen, children }: { accent: string; title: string; screen: ReactNode; children: ReactNode }) {
  return (
    <article className="flex flex-col border-4 border-[#0b0616] bg-[#1d1038] shadow-[inset_0_4px_0_#3f2c74,6px_6px_0_#0b0616]">
      <div className="h-1.5" style={{ background: accent }} aria-hidden="true" />
      <div className="p-3 pb-0">
        <div className="relative aspect-[3/2] overflow-hidden border-4 border-[#0b0616]" aria-hidden="true">
          {screen}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-balance font-pixel text-[16px] leading-snug text-white">{title}</h3>
        <p className="mt-2 font-game text-[15px] leading-relaxed text-[#c9b8f5]">{children}</p>
      </div>
    </article>
  );
}

/** Professor Birch on the opening's light spot, the starters' Poké Balls at his feet */
function Opening() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(#2c5870_0%,#4a8898_55%,#6aa8a0_56%,#8cc0a8_100%)]">
      <div className="relative flex flex-col items-center">
        <img src="/game/intro/birch.png" alt="" width={64} height={64} className="pixelated relative z-10 h-auto w-[34%] min-w-24" />
        <div className="-mt-[9%] h-5 w-44 rounded-[50%] bg-[radial-gradient(ellipse_at_50%_40%,#f8f8d0_0_45%,#d8e8a0_60%,#90b878_80%,transparent_82%)]" />
        <div className="absolute -bottom-1 flex gap-6">
          {[0, 1, 2].map((i) => (
            <span key={i} className="feel-ball" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mudkip walking across tall grass with its overworld sprite */
function Follower() {
  return (
    <div className="absolute inset-0 bg-[#58a838] bg-[radial-gradient(#78c850_2px,transparent_3px)] bg-[length:18px_18px]">
      <div className="absolute inset-x-0 bottom-[18%] h-[22%] bg-[repeating-linear-gradient(90deg,#3c8830_0_6px,#58a838_6px_14px)] opacity-60" />
      <span className="feel-walker" />
    </div>
  );
}

/** Eevee glowing and turning into Umbreon, the stones that evolve it beside */
function Evolution() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_45%,#304878,#101828_70%)]">
      <div className="relative size-[56%] max-w-40">
        <img src={sprite(133)} alt="" className="pixelated feel-before absolute inset-0 size-full object-contain" />
        <img src={sprite(197)} alt="" className="pixelated feel-after absolute inset-0 size-full object-contain" />
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1">
        {["fire_stone", "water_stone", "thunder_stone", "moon_stone"].map((stone) => (
          <img key={stone} src={`/game/items/${stone}.png`} alt="" width={24} height={24} className="pixelated size-7" />
        ))}
      </div>
    </div>
  );
}

/** Embers flying at a wild Pokémon, Emerald's own attack sprite */
function Attack() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(#e8f8d8_0_55%,#b8e0a0_55%)]">
      <div className="absolute bottom-[14%] right-[10%] h-[14%] w-[38%] rounded-[50%] bg-[#90c878]" />
      <img src={sprite(261)} alt="" className="pixelated absolute bottom-[18%] right-[14%] size-[36%] max-w-32 object-contain" />
      {[0, 1, 2].map((i) => (
        <span key={i} className="feel-ember" style={{ animationDelay: `0s, ${i * 0.18}s`, top: `${44 + i * 8}%` }} />
      ))}
    </div>
  );
}

/** The Pokémon Center's healing machine, its Poké Balls flashing */
function Healing() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#f8e8c0] bg-[radial-gradient(#f0d098_3px,transparent_4px)] bg-[length:22px_22px]">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-4 border-[#585870] bg-[#383850] p-4 shadow-[0_6px_0_#a0a0b8]">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <img
            key={i}
            src="/game/sprites/pokeball_glow.png"
            alt=""
            width={8}
            height={8}
            className="pixelated feel-glow size-8"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/** A page of the bag, with Emerald's item icons */
function Bag() {
  const rows = [
    ["rare_candy", "Rare Candy", 3],
    ["fire_stone", "Fire Stone", 1],
    ["revive", "Revive", 2],
    ["ultra_ball", "Ultra Ball", 10],
  ] as const;
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#a8d0f8] p-3">
      <ul className="w-full max-w-64 border-4 border-[#6868a0] bg-[#f8f8f8] px-3 py-2 font-pixel text-[13px] text-[#484850]">
        {rows.map(([icon, name, count], i) => (
          <li key={icon} className="flex items-center gap-2 py-0.5">
            <span className={i ? "invisible" : "blink"}>▶</span>
            <img src={`/game/items/${icon}.png`} alt="" width={24} height={24} className="pixelated size-6" />
            <span className="flex-1">{name}</span>
            <span>×{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The game feel: the little things from the Game Boy Advance games, each drawn with the game's own sprites */
export function GameFeel() {
  return (
    <section className="px-4 py-20">
      <Heading lead="All the little things from the Game Boy Advance games">
        It plays like <Pink>the real thing.</Pink>
      </Heading>
      <div className="mx-auto mt-14 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Tile accent="#f06aa6" title="Meet the Professor" screen={<Opening />}>
          A new game opens like Emerald: the Professor&apos;s welcome, boy or girl, your name, and a starter picked from his bag.
        </Tile>
        <Tile accent="#5ee07a" title="Your partner walks with you" screen={<Follower />}>
          Your lead Pokémon follows you around with its own Gen 3 overworld sprite, all 1,024 of them, in shiny colors too.
        </Tile>
        <Tile accent="#b9a6ff" title="Every way to evolve" screen={<Evolution />}>
          At a level, with stones, when friendly by day or by night, holding an item, or traded with a Linking Cord. Press B to stop it.
        </Tile>
        <Tile accent="#f8a040" title="Every move animated" screen={<Attack />}>
          490 moves play their own animation from Emerald&apos;s battle scripts: Ember&apos;s flames, Thunderbolt&apos;s bolts, Bite&apos;s teeth.
        </Tile>
        <Tile accent="#6db6ff" title="Pokémon Centers and Marts" screen={<Healing />}>
          The Nurse heals your party on Emerald&apos;s machine. Marts, the PC box, the Day Care and berry trees are there too.
        </Tile>
        <Tile accent="#f8d030" title="The GBA menus" screen={<Bag />}>
          Press Enter for the Pokédex, your party, summaries and a bag of 79 items in their pockets, with Emerald&apos;s icons.
        </Tile>
      </div>
    </section>
  );
}
