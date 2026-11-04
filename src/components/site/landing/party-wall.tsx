import { Sticker } from "./pixel";
import { sprite } from "./sprite";
import { cn } from "@/lib/utils";

/** Hoenn favorites for the party wall (national Pokédex numbers) */
const party = [
  [252, 280, 302, 334, 350, 359, 373, 376, 380, 384, 385, 311],
  [255, 258, 282, 303, 263, 278, 327, 333, 371, 374, 381, 312],
];

/** Catching: the party wall */
export function PartyWall() {
  return (
    <section className="py-20">
      <div className="px-4 text-center">
        <Sticker className="text-[26px] sm:text-[38px]">Catch them all.</Sticker>
        <p className="mt-5 font-pixel text-[20px] text-[#f06aa6] sm:text-[26px]">Build your party.</p>
      </div>
      <div className="mt-12 space-y-3" aria-hidden="true">
        {party.map((row, r) => (
          <div key={r} className={cn("flex w-max gap-3", r ? "slide-right" : "slide-left")}>
            {[...row, ...row].map((id, i) => (
              <div key={`${id}-${i}`} className="stepped grid size-24 shrink-0 place-items-center bg-[#1f1141] shadow-[inset_0_0_0_3px_#3f2c74] sm:size-56">
                <img src={sprite(id)} alt="" width={64} height={64} loading="lazy" className="pixelated size-20 sm:size-44" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mx-auto mt-12 max-w-[50ch] px-4 text-center font-game text-[16px] leading-relaxed text-[#c9b8f5]">
        All 1,025 Pokémon with their real types, stats and moves. They level up, evolve at the right level, and travel with you to every friend&apos;s game.
      </p>
    </section>
  );
}
