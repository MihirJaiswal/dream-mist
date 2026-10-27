import { BattleMenu } from "@/components/site/landing/battle-menu";
import { Dialogue } from "@/components/site/landing/dialogue";
import { LatestCities } from "@/components/site/latest-cities";
import { edit } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Main calls to action, as a battle menu */
const actions = [
  { label: "Build", href: edit(), hint: "Open the editor" },
  { label: "Explore", href: "/explore", hint: "Play friends' cities" },
  { label: "Learn", href: "/docs/first-game", hint: "Make your first game" },
  { label: "Guide", href: "/docs", hint: "Read the docs" },
];

/** Twinkling stars over the dream sky (percent positions, delay in seconds) */
const stars = [
  [8, 14, 0], [18, 32, 1.2], [27, 9, 0.6], [41, 22, 1.8], [52, 6, 0.3], [63, 28, 1.5],
  [71, 12, 0.9], [84, 20, 2.1], [92, 8, 0.4], [12, 52, 1.1], [88, 44, 1.7], [47, 40, 2.4],
];

/** Real numbers from the game data */
const stats = [
  { value: "1,025", label: "Pokémon to catch", ball: "poke" },
  { value: "6,328", label: "Hoenn tiles", ball: "great" },
  { value: "60", label: "real towns and routes", ball: "ultra" },
  { value: "40", label: "interiors per city", ball: "master" },
];

/** Type badge colors */
const types = {
  grass: "var(--color-grass)",
  psychic: "var(--color-psychic)",
  fire: "var(--color-fire)",
  water: "var(--color-water)",
} as const;

/** Animated Gen 5 sprite (natural size in pixels, drawn at `scale`) */
function Anim({ id, w, h, scale = 3, back = false, className }: { id: number; w: number; h: number; scale?: number; back?: boolean; className?: string }) {
  return <img src={`/site/sprites/anim-${back ? "back-" : ""}${id}.gif`} alt="" width={w * scale} height={h * scale} className={cn("pixelated", className)} />;
}

/** Type badge, as in the games */
function TypeBadge({ type }: { type: keyof typeof types }) {
  return (
    <span className="inline-flex items-center rounded-[4px] border-2 border-black/40 px-2 py-0.5 font-game text-[13px] font-bold uppercase tracking-wide text-white [text-shadow:1px_1px_0_rgb(0_0_0/0.4)]" style={{ background: types[type] }}>
      {type}
    </span>
  );
}

/** Pokédex-style feature entry */
function Entry({ number, type, title, points, children, visual, flip = false }: { number: string; type: keyof typeof types; title: string; points: string[]; children: ReactNode; visual: ReactNode; flip?: boolean }) {
  return (
    <article className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-16">
      <div className={cn("min-w-0", flip && "md:order-2")}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] text-subtle-fg">No. {number}</span>
          <TypeBadge type={type} />
        </div>
        <h3 className="mt-4 text-balance font-game text-[34px] font-bold leading-tight">{title}</h3>
        <div className="mt-4 max-w-[58ch] space-y-3 text-[15px] leading-relaxed text-muted-fg">{children}</div>
        <ul className="mt-6 grid gap-2 text-[14px]">
          {points.map((point) => (
            <li key={point} className="flex gap-3">
              <span className="mt-[7px] size-2 shrink-0 rotate-45" style={{ background: types[type] }} aria-hidden="true" />
              <span className="text-fg/90">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("min-w-0", flip && "md:order-1")}>{visual}</div>
    </article>
  );
}

/** Map render in a pixel frame, with the location sign the games show when entering a town */
function MapWindow({ src, place, className, children }: { src: string; place: string; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("pixel-frame relative overflow-hidden bg-surface", className)}>
      <img src={src} alt={`${place} built with the DreamMist editor`} className="pixelated block h-full w-full object-cover" />
      <span className="absolute left-3 top-3 rounded-[4px] border-[3px] border-[#5a3a20] bg-[#f4e2b0] px-3 py-1 font-game text-[15px] font-bold text-[#4a3018] shadow-[3px_3px_0_rgb(0_0_0/0.35)]">{place}</span>
      {children}
    </div>
  );
}

/** HP bar */
function Hp({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-sm bg-[#f8b830] px-1 text-[10px] font-bold leading-tight text-[#303040]">HP</span>
      <div className="h-2 flex-1 rounded-full border border-[#303040] bg-[#505060] p-px">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: value > 50 ? "#48d058" : value > 20 ? "#f8c030" : "#f05038" }} />
      </div>
    </div>
  );
}

/** Battle scene mock */
function BattleScene() {
  return (
    <div className="pixel-frame overflow-hidden bg-[#f0f8e0]">
      <div className="relative aspect-[3/2] bg-[linear-gradient(#bfe8f8_0%,#e8f8d8_55%,#c8e8a0_100%)]">
        {/* Foe */}
        <div className="absolute left-[6%] top-[8%] w-[46%] rounded-lg border-[3px] border-[#303040] bg-[#f8f8e8] px-3 py-2 font-game text-[#303040] shadow-[3px_3px_0_rgb(0_0_0/0.25)]">
          <div className="flex justify-between text-[15px] font-bold"><span>ZIGZAGOON</span><span>Lv4</span></div>
          <Hp value={34} />
        </div>
        <div className="absolute right-[10%] top-[30%] h-[9%] w-[34%] rounded-[50%] bg-[#a8d070]" />
        <Anim id={263} w={58} h={43} className="absolute right-[13%] top-[12%] w-[26%] h-auto" />
        {/* Player */}
        <div className="absolute bottom-[14%] left-[6%] h-[10%] w-[40%] rounded-[50%] bg-[#a8d070]" />
        <Anim id={255} w={31} h={46} back className="absolute bottom-[17%] left-[17%] w-[18%] h-auto" />
        <div className="absolute bottom-[8%] right-[5%] w-[46%] rounded-lg border-[3px] border-[#303040] bg-[#f8f8e8] px-3 py-2 font-game text-[#303040] shadow-[3px_3px_0_rgb(0_0_0/0.25)]">
          <div className="flex justify-between text-[15px] font-bold"><span>TORCHIC</span><span>Lv6</span></div>
          <Hp value={82} />
          <p className="mt-1 text-right text-[12px]">19 / 23</p>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 border-t-4 border-[#1b1530] bg-[#283050] p-2 font-game">
        <p className="rounded-md bg-[#f8f8f8] px-3 py-2 text-[16px] text-[#303040]">What will TORCHIC do?</p>
        <div className="grid grid-cols-2 gap-x-3 rounded-md bg-[#f8f8f8] px-3 py-1 text-[14px] font-bold text-[#303040]">
          <span>▶ FIGHT</span><span className="pl-3">BAG</span><span className="pl-3">POKéMON</span><span className="pl-3">RUN</span>
        </div>
      </div>
    </div>
  );
}

/** Story timeline mock */
function StoryCard() {
  const steps = [
    { name: "Meet the Professor", detail: "Done by Prof. Birch · gives 5 Poké Balls", done: true },
    { name: "Beat your rival", detail: "Wally shows up after step 1", done: true },
    { name: "Win the Mist Badge", detail: "A boulder blocks the road north", done: false },
  ];
  return (
    <div className="pixel-frame bg-surface p-5">
      <p className="font-pixel text-[11px] uppercase tracking-wider text-muted-fg">Story timeline</p>
      <ol className="relative mt-4 space-y-2 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-line">
        {steps.map(({ name, detail, done }, i) => (
          <li key={name} className={cn("relative flex gap-3 rounded-lg p-2", i === 2 && "bg-muted")}>
            <span className={cn("z-10 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]", done ? "border-fg bg-fg text-bg" : "border-line bg-surface text-muted-fg")}>{done ? "✓" : i + 1}</span>
            <div>
              <p className="text-[14px] font-medium">{name}</p>
              <p className="text-[12px] text-subtle-fg">{detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <Dialogue className="mt-5" speaker="Hiker" pages={["Sorry, the Gym Leader only sees trainers who beat their rival.", "Oh, you beat Wally? Go right ahead!"]} />
    </div>
  );
}

/** Live building mock */
function TogetherCard() {
  const builders = [
    { name: "may", color: "#f97316", x: "24%", y: "30%" },
    { name: "brendan", color: "#3b82f6", x: "60%", y: "64%" },
    { name: "wally", color: "#22c55e", x: "70%", y: "22%" },
  ];
  return (
    <MapWindow src="/site/maps/littleroot-town.png" place="Littleroot Town" className="aspect-square">
      {builders.map(({ name, color, x, y }) => (
        <span key={name} className="absolute flex items-start gap-0.5" style={{ left: x, top: y }}>
          <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path d="M1 1v14l4-4 3 6 3-1-3-6h5z" fill={color} stroke="#fff" strokeWidth="1.5" /></svg>
          <span className="mt-3 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: color }}>{name}</span>
        </span>
      ))}
      <div className="absolute bottom-3 right-3 flex -space-x-1.5">
        {builders.map(({ name, color }) => <span key={name} className="grid size-7 place-items-center rounded-full border-2 border-bg text-[11px] font-semibold uppercase text-white" style={{ background: color }}>{name[0]}</span>)}
      </div>
    </MapWindow>
  );
}

/** Drifting mist bands */
function Mist({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 overflow-hidden", className)} aria-hidden="true">
      <div className="drift flex h-full w-[200%]">
        <div className="mist h-full w-1/2" />
        <div className="mist h-full w-1/2" />
      </div>
    </div>
  );
}

/** Landing page */
export default function Home() {
  return (
    <>
      {/* Hero: the DreamMist dream sky */}
      <section className="relative overflow-hidden">
        <div className="pixelated absolute inset-0 bg-[url(/site/loaderbg.png)] bg-cover bg-[center_70%]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(30_18_56/0.78)_0%,rgb(30_18_56/0.45)_55%,rgb(30_18_56/0.1)_100%)]" aria-hidden="true" />
        {stars.map(([x, y, delay]) => (
          <span key={`${x}-${y}`} className="twinkle absolute size-1 bg-white shadow-[0_0_6px_2px_rgb(255_255_255/0.6)]" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }} aria-hidden="true" />
        ))}
        <Mist className="bottom-16 h-40 opacity-70" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-28 pt-16 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="min-w-0">
            <h1 className="pixel-shadow mt-6 text-balance font-pixel text-[34px] leading-[1.12] text-white sm:text-[52px]">Dream up your own Pokémon town.</h1>
            <p className="mt-6 max-w-[50ch] text-[17px] leading-relaxed text-white/85">
              Paint it with real Gen 3 tiles, fill the grass with wild Pokémon, write a story that opens the road step by step, then share a link so friends can play it, battle your gym and fork it.
            </p>
            <BattleMenu className="mt-9 max-w-[560px]" prompt="What will you do?" choices={actions} />
            <p className="mt-4 text-[13px] text-white/60">Free, runs in your browser, no download and no code.</p>
          </div>

          <div className="relative min-w-0">
            <Anim id={517} w={45} h={43} className="float absolute -right-3 -top-20 z-10 h-auto w-28 drop-shadow-[0_8px_18px_rgb(248_88_136/0.5)] sm:w-36" />
            <MapWindow src="/site/maps/oldale-town.png" place="Oldale Town" className="aspect-square">
              <Dialogue className="absolute inset-x-3 bottom-3" speaker="Prof. Birch" pages={["Welcome to the world of DreamMist!", "Here you build the town, and your friends live the adventure.", "Paint a route, hide Pokémon in the grass, and challenge them at your gym!"]} />
            </MapWindow>
          </div>
        </div>
      </section>

      {/* Trainer card stats */}
      {/* <section className="mx-auto max-w-7xl px-4 pt-16 md:px-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(({ value, label, ball }) => (
            <div key={label} className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-5">
              <img src={`/site/sprites/ball-${ball}.png`} alt="" width={32} height={32} className="pixelated size-10 shrink-0" />
              <div className="min-w-0">
                <dt className="sr-only">{label}</dt>
                <dd className="font-game text-[28px] font-bold leading-none tabular-nums">{value}</dd>
                <dd className="mt-1 text-[13px] text-subtle-fg">{label}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section> */}

      {/* Features as Pokédex entries */}
      <section className="mx-auto max-w-7xl px-4 pt-20 md:px-6">
        <div className="max-w-2xl">
          <p className="font-pixel text-[12px] uppercase tracking-wider text-dream">The DreamMist Dex</p>
          <h2 className="mt-3 text-balance text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">Everything a Pokémon game needs, no code required.</h2>
        </div>
        <div className="divide-y divide-line">
          <Entry
            number="001"
            type="grass"
            title="Paint with the real Hoenn tileset"
            points={["Stamps for houses, Pokémon Centers, Marts and trees", "Terrains that draw their own borders", "Start from 60 real towns and routes"]}
            visual={<MapWindow src="/site/maps/petalburg-city.png" place="Petalburg City" className="aspect-square" />}
          >
            <p>Ground, objects and an above-player layer, like the original games. Drag across the 6,328-tile palette to stamp anything, or import your own tileset.</p>
          </Entry>
          <Entry
            flip
            number="002"
            type="psychic"
            title="Write a story that opens the world"
            points={["Steps like “Meet the Professor” and “Win the badge”", "Roads blocked by trees, boulders or people", "Rewards, rivals who show up later, new dialogue"]}
            visual={<StoryCard />}
          >
            <p>Line up story steps, then decide who completes each one and what it unlocks. A Hiker steps aside once you beat your rival, a boulder disappears after the badge.</p>
          </Entry>
          <Entry
            number="003"
            type="fire"
            title="Battle, catch and earn badges"
            points={["All 1,025 Pokémon with real types, stats and moves", "Trainers who spot you from 4 tiles away", "Gym Leaders, badges, and a party that travels with you"]}
            visual={<BattleScene />}
          >
            <p>Press Play and your trainer walks the map you just built. Wild Pokémon hide in tall grass, trainers walk up to challenge you, and doors lead into gyms you designed.</p>
          </Entry>
          <Entry
            flip
            number="004"
            type="water"
            title="Build with friends, then share it"
            points={["Live rooms with cursors and chat", "Publish to Explore, collect likes", "Anyone can fork your city and build on it"]}
            visual={<TogetherCard />}
          >
            <p>Send an invite link and build the same city at the same time. When it's ready, publish it so anyone can play it from a link.</p>
          </Entry>
        </div>
      </section>

      {/* Three steps, as a starter pick */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="text-center">
          <p className="font-pixel text-[12px] uppercase tracking-wider text-dream">Choose your starter</p>
          <h2 className="mt-3 text-balance text-[32px] font-semibold tracking-tight sm:text-[40px]">Three steps to your first game</h2>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { sprite: 252, size: [43, 63], type: "grass" as const, title: "Build", text: "Open the editor, pick a starter town or a real Hoenn map, and paint." },
            { sprite: 255, size: [33, 47], type: "fire" as const, title: "Play", text: "Press Play to walk it, battle your trainers and test your story." },
            { sprite: 258, size: [43, 49], type: "water" as const, title: "Share", text: "Publish it to Explore and send the link to your friends." },
          ].map(({ sprite, size, type, title, text }, i) => (
            <li key={title} className="group relative overflow-hidden rounded-xl border border-line bg-surface p-6 transition-colors hover:border-fg/30">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: types[type] }} aria-hidden="true" />
              <div className="flex items-start justify-between">
                <span className="font-mono text-[13px] text-subtle-fg">0{i + 1}</span>
                <div className="grid h-28 w-28 place-items-end justify-items-center"><Anim id={sprite} w={size[0]} h={size[1]} scale={2} className="transition-transform duration-300 group-hover:-translate-y-1" /></div>
              </div>
              <h3 className="mt-2 font-game text-[26px] font-bold">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-fg">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <LatestCities />

      {/* Closing call to action under the dream sky */}
      <section className="px-4 pb-24 pt-8 md:px-6">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-line">
          <div className="pixelated absolute inset-0 bg-[url(/site/loaderbg.png)] bg-cover bg-bottom" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(30_18_56/0.85),rgb(30_18_56/0.55)_60%,rgb(30_18_56/0.15))]" aria-hidden="true" />
          <Mist className="bottom-0 h-32 opacity-60" />
          <div className="relative grid items-center gap-10 p-8 md:grid-cols-[1fr_auto] md:p-14">
            <div className="min-w-0">
              <h2 className="pixel-shadow text-balance font-pixel text-[26px] leading-tight text-white sm:text-[34px]">Your dream town is waiting.</h2>
              <p className="mt-4 max-w-[48ch] text-[15px] text-white/80">Start from a blank field, a starter town, or any of the 60 real places in Hoenn.</p>
              <BattleMenu className="mt-8 max-w-[560px]" prompt="Ready?" choices={actions.slice(0, 2).concat(actions.slice(2, 4))} />
            </div>
            <div className="relative hidden md:block">
              <Anim id={518} w={77} h={74} className="float h-auto w-56 drop-shadow-[0_10px_30px_rgb(248_88_136/0.5)]" />
              <img src="/site/sprites/ball-dream.png" alt="" width={48} height={48} className="pixelated float absolute -left-6 bottom-2 size-12 [animation-delay:-1.4s]" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
