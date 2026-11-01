import { Dialogue } from "@/components/site/landing/dialogue";
import { Cloud, Ledge, PixelButton, Sticker } from "@/components/site/landing/pixel";
import { StoryScrolls } from "@/components/site/landing/story-scrolls";
import { LatestCities } from "@/components/site/latest-cities";
import { edit } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Twinkling stars over the night sky (percent positions, delay in seconds) */
const stars = [
  [6, 12, 0], [14, 34, 1.2], [23, 8, 0.6], [33, 26, 1.8], [44, 5, 0.3], [56, 18, 1.5], [64, 9, 0.9],
  [73, 30, 2.1], [81, 7, 0.4], [90, 22, 1.1], [96, 40, 1.7], [4, 52, 2.4], [38, 46, 0.8], [68, 48, 1.3],
];

/** Real numbers from the game data */
const stats = [
  { value: "1,025", label: "Pokémon" },
  { value: "6,328", label: "Hoenn tiles" },
  { value: "60", label: "real towns and routes" },
  { value: "40", label: "maps in one town" },
];

/** Hoenn favorites for the party wall (national Pokédex numbers) */
const party = [
  [252, 280, 302, 334, 350, 359, 373, 376, 380, 384, 385, 311],
  [255, 258, 282, 303, 263, 278, 327, 333, 371, 374, 381, 312],
];

/** Gen 3 sprite, the same ones the game uses */
const sprite = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/ruby-sapphire/${id}.png`;

/** Animated Gen 5 sprite (natural size in pixels, drawn at `scale`) */
function Anim({ id, w, h, scale = 3, back = false, className }: { id: number; w: number; h: number; scale?: number; back?: boolean; className?: string }) {
  return <img src={`/site/sprites/anim-${back ? "back-" : ""}${id}.gif`} alt="" width={w * scale} height={h * scale} className={cn("pixelated", className)} />;
}

/** Two-line section heading: a small lead-in, then the title with one word in pink */
function Heading({ lead, children, className }: { lead?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      {lead ? <p className="font-game text-[15px] text-[#c9b8f5]">{lead}</p> : null}
      <h2 className="mt-2 text-balance font-pixel text-[30px] leading-[1.15] text-white sm:text-[44px]">{children}</h2>
    </div>
  );
}

/** Pink word in a heading */
function Pink({ children }: { children: ReactNode }) {
  return <span className="text-[#f06aa6]">{children}</span>;
}

/** HP bar over a Pokémon on the stage */
function Hp({ name, level, value }: { name: string; level: number; value: number }) {
  return (
    <div className="stepped w-32 bg-[#1d1038] px-2 py-1.5 font-game text-[12px] text-white sm:w-36">
      <div className="flex justify-between"><span>{name}</span><span>Lv{level}</span></div>
      <div className="mt-1 h-2 bg-[#0b0616] p-px"><div className="h-full" style={{ width: `${value}%`, background: value > 50 ? "#5ee07a" : value > 20 ? "#f8c030" : "#f05038" }} /></div>
    </div>
  );
}

/** Feature card: a chunky game panel with the map in its own window and the games' location sign */
function Feature({ number, accent, title, children, image, place }: { number: number; accent: string; title: string; children: ReactNode; image: string; place: string }) {
  return (
    <article className="group flex flex-col border-4 border-[#0b0616] bg-[#1d1038] shadow-[inset_0_4px_0_#3f2c74,6px_6px_0_#0b0616] transition-[translate,box-shadow] duration-150 ease-[steps(3)] hover:-translate-y-1 hover:shadow-[inset_0_4px_0_#3f2c74,8px_10px_0_#0b0616]">
      <div className="h-1.5" style={{ background: accent }} aria-hidden="true" />
      <div className="p-3 pb-0">
        <div className="relative aspect-[4/3] overflow-hidden border-4 border-[#0b0616]">
          <img src={image} alt={`${place} built with the DreamMist editor`} className="pixelated h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <span className="absolute bottom-2 left-2 border-[3px] border-[#5a3a20] bg-[#f4e2b0] px-2 py-0.5 font-game text-[13px] font-bold text-[#4a3018] shadow-[2px_2px_0_rgb(0_0_0/0.4)]">{place}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="font-pixel text-[11px]" style={{ color: accent }}>No. 0{number}</span>
        <h3 className="mt-1.5 text-balance font-pixel text-[16px] leading-snug text-white">{title}</h3>
        <p className="mt-2 font-game text-[15px] leading-relaxed text-[#c9b8f5]">{children}</p>
      </div>
    </article>
  );
}

/** Landing page */
export default function Home() {
  return (
    <div className="night overflow-hidden">
      {/* Hero: night sky, a dreaming Musharna and the big sticker headline */}
      <section className="relative">
        {/* The dream sky picture, darkened so the headline and buttons stay readable */}
        <div className="pixelated absolute inset-0 bg-[url(/site/herobg.avif)] bg-cover bg-[center_70%]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(13_7_32/0.4)_0%,rgb(20_11_42/0.44)_25%,rgb(30_16_60/0.44)_100%)]" aria-hidden="true" />
        {stars.map(([x, y, delay]) => (
          <span key={`${x}-${y}`} className="twinkle absolute size-1 bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }} aria-hidden="true" />
        ))}
        {/* <Cloud className="absolute -left-16 top-48 w-60 opacity-90 sm:-left-10 sm:top-24 sm:w-[448px]" />
        <Cloud flip className="absolute -right-20 top-2 w-56 opacity-80 sm:-right-12 sm:top-10 sm:w-[404px]" />
        <Cloud className="absolute -right-6 bottom-40 hidden w-96 opacity-70 md:block" />
        <Cloud flip className="absolute bottom-56 left-[8%] hidden w-56 opacity-60 lg:block" /> */}

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-0 pt-12 text-center md:pt-16">
          <p className="font-pixel text-[30px] leading-none text-[#f06aa6] [text-shadow:4px_4px_0_#4a1640] sm:text-[44px]">DreamMist</p>
          <p className="mt-2 font-game text-[16px] text-[#c9b8f5]">Pokémon town builder</p>

          <div className="relative mt-6">
            <div className="absolute inset-x-6 bottom-4 top-10 rounded-full bg-[#f06aa6]/25 blur-3xl" aria-hidden="true" />
            <Anim id={518} w={77} h={74} scale={3} className="float relative h-auto w-52 sm:w-64" />
          </div>

          <h1 className="relative -mt-6 flex flex-col items-center gap-3">
            <Sticker className="text-[30px] sm:text-[48px]">Build your own</Sticker>
            <span className="font-pixel text-[30px] leading-tight text-white [text-shadow:4px_4px_0_#0b0616] sm:text-[48px]">Pokémon town.</span>
          </h1>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <PixelButton href={edit()}>Start building</PixelButton>
            <PixelButton href="/explore" tone="lilac">Explore towns</PixelButton>
          </div>
          <p className="mt-5 font-game text-[13px] text-[#e8e3f7]">Free, in your browser, no download and no code.</p>

          {/* Starters waiting on the ledge */}
          <div className="relative mt-12 flex w-full max-w-3xl items-end justify-between px-6 sm:px-16">
            {/* Treecko's animation stands 6 of its 63 pixels above the bottom of the image: lower it onto the ledge */}
            <Anim id={252} w={43} h={63} scale={2} className="h-auto w-[72px] translate-y-[9.5%] sm:w-[86px]" />
            <Anim id={255} w={33} h={47} scale={2} className="h-auto w-[56px] sm:w-[66px]" />
            <Anim id={258} w={43} h={49} scale={2} className="h-auto w-[72px] sm:w-[86px]" />
          </div>
        </div>
        <Ledge className="relative" />
      </section>

      {/* The Professor welcomes you, under the ledge */}
      <section className="border-b-[3px] border-[#2d1a52] bg-[#1d1038] px-4 py-10">
        <div className="mx-auto flex max-w-3xl items-stretch gap-4">
          <div className="stepped hidden shrink-0 bg-[#b9a6ff] p-[3px] sm:block" aria-hidden="true">
            <div className="stepped grid h-[136px] w-[112px] place-items-end justify-center bg-[linear-gradient(#f8f0d8_60%,#d8e8a8_60%)] pb-2">
              <img src="/site/professor.avif" alt="" width={14} height={20} className="pixelated h-[120px] w-auto" />
            </div>
          </div>
          <Dialogue className="min-w-0 flex-1" speaker="Professor" pages={["Welcome to the world of DreamMist!", "Here, you build the town: the routes, the tall grass, the gym and the story.", "Then your friends walk in and live the adventure you made. Ready?"]} />
        </div>
      </section>

      {/* Battles: the stage */}
      <section className="relative px-4 pb-20 pt-24">
        <Heading lead="Press Play and walk the town you just built">Battle everyone in <Pink>your dream town.</Pink></Heading>
        <p className="mx-auto mt-5 max-w-[52ch] text-center font-game text-[16px] leading-relaxed text-[#c9b8f5]">
          Wild Pokémon hide in tall grass, trainers walk up when they spot you, and Gym Leaders wait behind the doors you placed.
        </p>
        <div className="relative mx-auto mt-14 max-w-5xl">
          <Cloud flip className="absolute -left-8 -top-6 w-56 opacity-70" />
          <Cloud className="absolute -right-6 top-4 w-60 opacity-70" />
          <div className="relative">
            {/* Buildings on both sides of the battle, built from the game's own tiles (same 3× pixels as the Pokémon), the middle left open.
                Darkened on the building pixels only (a black overlay would also darken the sky around them), so the Pokémon stand out */}
            <div className="pointer-events-none absolute bottom-0 left-1/2 flex h-[160px] w-screen -translate-x-1/2 justify-between brightness-[0.18] saturate-[0.7] sm:h-[240px]" aria-hidden="true">
              <div className="pixelated h-full w-[38%] bg-[url(/site/town-left.png)] bg-[length:auto_100%] bg-[position:right_bottom] bg-repeat-x" />
              <div className="pixelated h-full w-[38%] bg-[url(/site/town-right.png)] bg-[length:auto_100%] bg-[position:left_bottom] bg-repeat-x" />
            </div>
            {/* Full moon in the open sky between the two sides */}
            <img src="/site/moon.avif" alt="" aria-hidden="true" width={1263} height={1245} className="pixelated pointer-events-none absolute left-1/2 top-4 h-auto w-28 -translate-x-1/2 drop-shadow-[0_0_28px_rgb(255_244_214/0.35)] sm:top-0 sm:w-52" />
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
          <Dialogue className="relative mx-auto mt-10 max-w-2xl" speaker="" pages={["A wild ZIGZAGOON appeared!", "Go! TORCHIC!", "TORCHIC used EMBER! It's super effective!"]} />
        </div>
      </section>

      {/* Story: one scroll per starter, click a side one to read it */}
      <section className="px-4 py-16">
        <StoryScrolls />
      </section>

      {/* Catching: the party wall */}
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
          All 1,025 Pokémon with their real types, stats and moves. They level up, evolve at the right level, and travel with you to every friend&apos;s town.
        </p>
      </section>

      {/* Everything else: feature cards and stats */}
      <section className="px-4 py-20">
        <Heading lead="No code, all in your browser">Everything a <Pink>Pokémon game</Pink> needs.</Heading>
        <div className="mx-auto mt-14 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Feature number={1} accent="#f06aa6" title="Paint real Hoenn tiles" image="/site/maps/petalburg-city.png" place="Petalburg City">Houses, Pokémon Centers and trees, terrains that draw their own borders, or your own tileset.</Feature>
          <Feature number={2} accent="#b9a6ff" title="Join routes and towns" image="/site/maps/rustboro-city.png" place="Rustboro City">Put routes and other towns side by side, and walk from one to the next across their edges.</Feature>
          <Feature number={3} accent="#5ee07a" title="Start from real places" image="/site/maps/fortree-city.png" place="Fortree City">Begin from any of the 60 towns and routes of Hoenn, or from a blank field.</Feature>
          <Feature number={4} accent="#6db6ff" title="Build with friends" image="/site/maps/littleroot-town.png" place="Littleroot Town">Share an invite link and build the same town at the same time, then publish it to Explore.</Feature>
        </div>
        <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-y-8 md:grid-cols-4">
          {stats.map(({ value, label }, i) => (
            <div key={label} className={cn("px-4 text-center", i && "md:border-l-2 md:border-dashed md:border-[#3f2c74]")}>
              <dt className="font-game text-[14px] text-[#9b8cc9]">{label}</dt>
              <dd className="mt-1 font-pixel text-[26px] text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <LatestCities />

      {/* Closing call to action over a giant "press start" */}
      <section className="relative isolate px-4 py-32">
        {/* Moonlit sky (anchored left and scaled up so the moon sits beside the headline, not behind it), fading into the page above */}
        <div className="pixelated absolute inset-0 -z-10 bg-[url(/site/bg2.avif)] bg-[length:max(130%,1100px)_auto] bg-[position:0%_25%] bg-no-repeat" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-black/50" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(#140b26_0%,rgb(20_11_38/0.3)_25%,rgb(20_11_38/0.3)_80%,#140b26_100%)]" aria-hidden="true" />
        <p className="pointer-events-none absolute inset-x-0 top-6 select-none text-center font-pixel text-[64px] leading-none text-white/[0.8] sm:text-[140px]" aria-hidden="true">Press start</p>
        <Cloud className="absolute -left-10 bottom-10 w-80 opacity-70" />
        <Cloud flip className="absolute -right-10 top-16 w-72 opacity-70" />
        <div className="relative flex flex-col items-center text-center">
          <Anim id={517} w={45} h={43} scale={3} className="float h-auto w-28" />
          <h2 className="mt-4 flex flex-col items-center gap-3">
            <Sticker className="text-[26px] sm:text-[40px]">Your dream town</Sticker>
            <span className="font-pixel text-[26px] text-white [text-shadow:4px_4px_0_#0b0616] sm:text-[40px]">is waiting.</span>
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <PixelButton href={edit()}>Start building</PixelButton>
            <PixelButton href="/docs/first-game" tone="lilac">Make your first game</PixelButton>
          </div>
        </div>
      </section>
    </div>
  );
}
