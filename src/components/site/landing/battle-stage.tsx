import { Dialogue } from "./dialogue";
import { Cloud, Ledge } from "./pixel";
import { Anim, Heading, Hp, Pink } from "./sprite";

/** Battles: the stage */
export function BattleStage() {
  return (
    <section className="relative px-4 pb-20 pt-24">
      <Heading lead="Press Play and walk the town you just built">
        Battle everyone in <Pink>your dream town.</Pink>
      </Heading>
      <p className="mx-auto mt-5 max-w-[52ch] text-center font-game text-[16px] leading-relaxed text-[#c9b8f5]">
        Wild Pokémon hide in tall grass, trainers walk up when they spot you, and Gym Leaders wait behind the doors you placed.
      </p>
      <div className="relative mx-auto mt-14 max-w-5xl">
        <Cloud flip className="absolute -left-8 -top-6 w-56 opacity-70" />
        <Cloud className="absolute -right-6 top-4 w-60 opacity-70" />
        <div className="relative">
          {/* Buildings on both sides of the battle, built from the game's own tiles (same 3× pixels as the Pokémon), the middle left open.
              Darkened on the building pixels only (a black overlay would also darken the sky around them), so the Pokémon stand out */}
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 flex h-[160px] w-screen -translate-x-1/2 justify-between brightness-[0.18] saturate-[0.7] sm:h-[240px]"
            aria-hidden="true"
          >
            <div className="pixelated h-full w-[38%] bg-[url(/site/town-left.png)] bg-[length:auto_100%] bg-[position:right_bottom] bg-repeat-x" />
            <div className="pixelated h-full w-[38%] bg-[url(/site/town-right.png)] bg-[length:auto_100%] bg-[position:left_bottom] bg-repeat-x" />
          </div>
          {/* Full moon in the open sky between the two sides */}
          <img
            src="/site/moon.avif"
            alt=""
            aria-hidden="true"
            width={1263}
            height={1245}
            className="pixelated pointer-events-none absolute left-1/2 top-4 h-auto w-28 -translate-x-1/2 drop-shadow-[0_0_28px_rgb(255_244_214/0.35)] sm:top-0 sm:w-52"
          />
          <div className="relative grid grid-cols-2 items-end gap-2 px-1 pt-16 sm:gap-4 sm:px-12">
            <div className="flex flex-col items-start gap-3">
              <Hp name="TORCHIC" level={8} value={78} />
              <Anim id={255} w={33} h={47} scale={3} back className="h-auto w-[90px] sm:w-[110px]" />
            </div>
            <div className="flex flex-col items-end gap-3">
              <Hp name="ZIGZAGOON" level={5} value={26} />
              <Anim id={263} w={58} h={43} scale={3} className="h-auto w-[130px] sm:w-[160px]" />
            </div>
          </div>
        </div>
        {/* The ledge runs the full width of the window, past the centered stage */}
        <Ledge className="relative left-1/2 w-screen -translate-x-1/2" />
        <Dialogue
          className="relative mx-auto mt-10 max-w-2xl"
          speaker=""
          pages={["A wild ZIGZAGOON appeared!", "Go! TORCHIC!", "TORCHIC used EMBER! It's super effective!"]}
        />
      </div>
    </section>
  );
}
