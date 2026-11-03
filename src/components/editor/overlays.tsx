"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { Button } from "@/components/ui/button";
import { artwork, battleSprite, npc as texture, preview } from "@/game/assets";
import { CanvasView } from "@/components/editor/widgets";
import { scaleOf } from "@/game/sprites";
import { Battle, type BattleSide, type BattleView, type Slot, statusLabels } from "@/game/battle";
import { hour } from "@/game/atmosphere";
import { cloud } from "@/game/cloud";
import { autoScene, type Scene, sceneOf, scenePicture, typeOf } from "@/game/data";
import { session } from "@/game/session";
import { hp, named } from "@/game/trainer";
import type { Banner, Portrait } from "@/game/ui-bridge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Eyedropper, Users } from "@phosphor-icons/react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

//=================================================================================================
// Dialogue box

type Line = { text: string; speaker: string; portrait?: Portrait; choices?: string[]; done: (choice: number) => void };
let queue = [] as Line[];
const lineListeners = new Set<() => void>();
const emitLines = () => lineListeners.forEach((listener) => listener());

/** Show a dialogue (blank lines split pages), resolves when the player dismisses the last page */
export function say(text: string, { speaker = "", portrait }: { speaker?: string; portrait?: Portrait } = {}) {
  return new Promise<void>((done) => {
    queue = [...queue, { text, speaker, portrait, done: () => done() }];
    emitLines();
  });
}

/** Ask a question in the dialogue box: YES/NO appears with its last page, resolves with the answer */
export function ask(text: string, voice: { speaker?: string; portrait?: Portrait } = {}) {
  return choose(text, ["YES", "NO"], voice).then((choice) => choice === 0);
}

/** Pick one of a few answers in the dialogue box (X picks the last one, like CANCEL), resolves with its index */
export function choose(text: string, choices: string[], { speaker = "", portrait }: { speaker?: string; portrait?: Portrait } = {}) {
  return new Promise<number>((done) => {
    queue = [...queue, { text, speaker, portrait, choices, done }];
    emitLines();
  });
}

/** Close the dialogue box, dropping pending lines without resolving them, so a stopped game doesn't carry on talking */
export function hush() {
  if (queue.length) {
    queue = [];
    emitLines();
  }
}

/** Follow the dialogue queue */
const subscribeLines = (listener: () => void) => (lineListeners.add(listener), () => void lineListeners.delete(listener));

/** Who is speaking in the dialogue box right now ("" when it's closed) */
export function useSpeaker() {
  const lines = useSyncExternalStore(
    subscribeLines,
    () => queue,
    () => queue,
  );
  return lines[0]?.speaker ?? "";
}

/** Game dialogue box: types each page, Space/Enter/Z/E or a click continues */
export function DialogueBox() {
  const lines = useSyncExternalStore(
    subscribeLines,
    () => queue,
    () => queue,
  );
  const line = lines[0];
  const pages = line
    ? line.text
        .split(/\n\s*\n/)
        .map((page) => page.trim())
        .filter(Boolean)
    : [];
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const [choice, setChoice] = useState(0);
  //Start over on a new line, and type again on a new page
  const [at, setAt] = useState<{ line?: Line; page: number }>({ page: 0 });
  if (at.line !== line) {
    setAt({ line, page: 0 });
    setPage(0);
    setShown(0);
    setChoice(0);
  } else if (at.page !== page) {
    setAt({ line, page });
    setShown(0);
  }
  const text = pages[page] ?? "";
  useEffect(() => {
    const timer = setInterval(() => setShown((count) => (count >= text.length ? (clearInterval(timer), count) : count + 1)), 18);
    return () => clearInterval(timer);
  }, [text, line, page]);
  const asking = Boolean(line?.choices) && page === pages.length - 1 && shown >= text.length;
  //Continue: finish typing, then next page, then close (with the picked answer on a question)
  const advance = (picked = choice) => {
    if (!line) {
      return;
    }
    if (shown < text.length) {
      return setShown(text.length);
    }
    if (page < pages.length - 1) {
      return setPage(page + 1);
    }
    queue = queue.slice(1);
    emitLines();
    line.done(picked);
  };
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    //Questions: up and down move between the answers, X or Escape answers the last one (NO)
    if (asking && line?.choices && ["arrowup", "arrowdown", "w", "s", "x", "escape"].includes(key)) {
      event.preventDefault();
      event.stopPropagation();
      if (key === "x" || key === "escape") {
        return advance(line.choices.length - 1);
      }
      return setChoice((current) => (current + (key === "arrowdown" || key === "s" ? 1 : line.choices!.length - 1)) % line.choices!.length);
    }
    if ([" ", "enter", "z", "e"].includes(key) && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      advance();
    }
  });
  useEffect(() => {
    if (!line) {
      return;
    }
    const keys = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", keys, true);
    return () => document.removeEventListener("keydown", keys, true);
  }, [line]);
  if (!line) {
    return null;
  }
  const typing = shown < text.length;
  return (
    <div className="game-dialogue" role="dialog" aria-live="polite" aria-label={line.speaker || "Message"} onClick={() => !asking && advance()}>
      {asking ? (
        <div className="choices" role="listbox" aria-label="Answer">
          {line.choices!.map((label, i) => (
            <button
              key={label}
              role="option"
              aria-selected={i === choice}
              className={cn(i === choice && "picked")}
              onMouseEnter={() => setChoice(i)}
              onClick={(event) => (event.stopPropagation(), advance(i))}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {line.portrait ? <img key={line.portrait.src} className={cn("portrait", line.portrait.kind)} src={line.portrait.src} alt="" draggable={false} /> : null}
      <div className="box">
        {line.speaker ? <div className="speaker">{line.speaker}</div> : null}
        {/* The full page is laid out invisibly so the box doesn't grow while typing */}
        <div className="text">
          <span>{text.slice(0, shown)}</span>
          <span className="rest" aria-hidden="true">
            {text.slice(shown)}
          </span>
        </div>
        {typing || asking ? null : <div className={cn("next", page < pages.length - 1 ? "more" : "end")} aria-hidden="true" />}
      </div>
    </div>
  );
}

//=================================================================================================
// Battle

/** One side of the battle */
/** Battle background tints for the map's time of day and weather (the Pokémon keep their colors) */
const tints: Record<string, string> = {
  morning: "rgb(255 210 160 / 0.14)",
  evening: "rgb(255 106 32 / 0.22)",
  night: "rgb(11 24 64 / 0.5)",
  rain: "rgb(80 112 160 / 0.18)",
  fog: "rgb(223 230 236 / 0.35)",
  sandstorm: "rgb(200 160 96 / 0.25)",
  snow: "rgb(220 235 255 / 0.18)",
};

/** Where the battle happens: an Emerald scene (widened with its edge colors) or an uploaded picture, tinted by the map's time and weather */
function Scene({ overlays, picture, scene }: { overlays: string[]; picture: string; scene: Scene | null }) {
  return (
    <div className="scene" aria-hidden="true" style={scene ? { backgroundImage: `url("/game/battle/${scene}-edge.png")` } : undefined}>
      <div className="picture" style={{ backgroundImage: `url("${picture}")` }} />
      {overlays.map((key) => (
        <div key={key} className="tint" style={{ background: tints[key] }} />
      ))}
    </div>
  );
}

/** Info box: name, level, condition, HP (and experience for your Pokémon) */
function Info({ view, foe, slot }: { view: BattleSide; foe: boolean; slot: Slot }) {
  const creature = view.creature;
  const ratio = Math.max(0, creature.hp) / hp(creature);
  const start = creature.level ** 3,
    end = (creature.level + 1) ** 3;
  return (
    <div className={cn("infobox", foe ? "foe" : "ally", slot)} style={{ visibility: view.info ? "visible" : "hidden" }}>
      <div className="card">
        <div className="row">
          <b>
            {named(creature)}
            {creature.shiny ? " ✨" : ""}
          </b>
          <span className="level">
            {creature.status ? (
              <span className="status" style={{ background: statusLabels[creature.status].color }}>
                {statusLabels[creature.status].label}
              </span>
            ) : null}
            <small>Lv.</small>
            {creature.level}
          </span>
        </div>
        <div className="hp">
          <span className="tag">HP</span>
          <div className="bar">
            <div className="fill" style={{ width: `${ratio * 100}%`, background: ratio > 0.5 ? "#48d058" : ratio > 0.2 ? "#f8c030" : "#f05038" }} />
          </div>
        </div>
        {foe ? null : (
          <div className="numbers">
            {Math.max(0, creature.hp)}/{hp(creature)}
          </div>
        )}
        {foe ? null : (
          <div className="exp">
            <div className="fill" style={{ width: `${Math.min(1, (creature.exp - start) / (end - start)) * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** A Pokémon standing on its platform: animated battle sprite at a whole-pixel size, the still artwork if it can't load */
function Side({ side, view, foe }: { side: Slot; view: BattleSide; foe: boolean }) {
  const creature = view.creature;
  const sprite = battleSprite(creature.species, { back: !foe, shiny: creature.shiny });
  const [failed, setFailed] = useState("");
  const custom = Boolean(creature.art);
  const still = custom || failed === sprite.src;
  return (
    <div className={`side ${foe ? "foe" : "ally"}`} data-slot={side}>
      <div className="platform" />
      <div className="stand">
        <img
          key={`${view.entered}:${view.fxKey}`}
          className={cn("mon", still ? "still" : sprite.animated ? "animated" : "big", view.fx, view.entered && !view.fx ? "enter" : "")}
          alt=""
          draggable={false}
          src={custom ? creature.art : still ? artwork(creature.species, { back: !foe, shiny: creature.shiny }) : sprite.src}
          onError={() => setFailed(sprite.src)}
          style={{ scale: custom && !foe ? "-1 1" : undefined }}
        />
      </div>
    </div>
  );
}

/** Gen 3 animation sprites of each type: one that flies at the target, one that bursts on it */
const typeSprites: Record<string, { fly: string; burst: string }> = {
  normal: { fly: "yellow_star", burst: "hit" },
  fire: { fly: "small_ember", burst: "fire" },
  water: { fly: "water_orb", burst: "bubble" },
  electric: { fly: "spark_0", burst: "lightning" },
  grass: { fly: "razor_leaf", burst: "leaf" },
  ice: { fly: "ice_crystals_0", burst: "ice_chunk" },
  fighting: { fly: "punch_impact", burst: "punch_impact" },
  poison: { fly: "poison_bubble", burst: "poison_bubble" },
  ground: { fly: "flying_dirt", burst: "rocks" },
  flying: { fly: "white_feather", burst: "gust" },
  psychic: { fly: "spiral", burst: "spiral" },
  bug: { fly: "needle", burst: "hit" },
  rock: { fly: "rocks", burst: "rocks" },
  ghost: { fly: "shadow_ball", burst: "shadow_ball" },
  dragon: { fly: "blue_flames", burst: "blue_flames" },
  dark: { fly: "purple_scratch", burst: "purple_scratch" },
  steel: { fly: "metal_ball", burst: "impact" },
  fairy: { fly: "pink_heart_2", burst: "sparkle_1" },
};

/** Frame size and count of each animation sprite (loaded once) */
let animFrames: Record<string, { size: number; frames: number }> = {};
const animIndex =
  typeof window === "undefined"
    ? null
    : fetch("/game/battle/anims/index.json")
        .then((response) => response.json())
        .then(
          (index) => (animFrames = index),
          () => ({}),
        );

/** One animation sprite: its frames play while it moves (positions in pixels of the stage) */
function Sprite({
  name,
  className,
  from,
  to,
  delay = 0,
  scale = 3,
}: {
  name: string;
  className: string;
  from: { x: number; y: number };
  to?: { x: number; y: number };
  delay?: number;
  scale?: number;
}) {
  const { size = 32, frames = 1 } = animFrames[name] ?? {};
  return (
    <div
      className={cn("fx", className)}
      style={
        {
          "--x0": `${from.x}px`,
          "--y0": `${from.y}px`,
          "--x1": `${(to ?? from).x}px`,
          "--y1": `${(to ?? from).y}px`,
          "--size": `${size * scale}px`,
          "--frames": frames,
          "--sheet": `${size * scale * frames}px`,
          animationDelay: `${delay}ms, ${delay}ms`,
          backgroundImage: `url("/game/battle/anims/${name}.png")`,
        } as React.CSSProperties
      }
    />
  );
}

/** Attack animation over the stage: projectiles flying at the target, an impact on it, or a glow around the user */
function Attack({ anim }: { anim: NonNullable<BattleView["anim"]> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<null | { user: { x: number; y: number }; target: { x: number; y: number } }>(null);
  const [, ready] = useState(0);
  useLayoutEffect(() => {
    const layer = ref.current;
    const stage = layer?.parentElement?.querySelector(".stage");
    const box = stage?.getBoundingClientRect();
    const center = (slot: string) => {
      const rect = stage?.querySelector(`.side[data-slot="${slot}"] .mon`)?.getBoundingClientRect();
      return rect && box ? { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 } : { x: 0, y: 0 };
    };
    setSpots({ user: center(anim.from), target: center(anim.to) });
    void animIndex?.then(() => ready((n) => n + 1));
  }, [anim]);
  const sprites = typeSprites[anim.type] ?? typeSprites.normal;
  return (
    <div ref={ref} className="fx-layer" aria-hidden="true">
      {spots ? (
        anim.mode === "self" ? (
          anim.protect ? (
            <Sprite name="protect" className="glow" from={spots.user} scale={4} />
          ) : (
            [0, 1, 2].map((i) => (
              <Sprite key={i} name="sparkle_1" className="glow" from={{ x: spots.user.x + (i - 1) * 34, y: spots.user.y - (i % 2) * 26 }} delay={i * 90} />
            ))
          )
        ) : anim.mode === "projectile" ? (
          <>
            {[0, 1, 2].map((i) => (
              <Sprite key={i} name={sprites.fly} className="fly" from={spots.user} to={spots.target} delay={i * 70} />
            ))}
            <Sprite name={sprites.burst} className="burst" from={spots.target} delay={330} />
          </>
        ) : (
          <>
            <Sprite name="impact" className="burst" from={spots.target} scale={3} />
            <Sprite name={sprites.burst} className="burst" from={{ x: spots.target.x + 10, y: spots.target.y - 8 }} delay={90} />
          </>
        )
      ) : null}
    </div>
  );
}

/** Battle scene of the running battle */
export function BattleScreen() {
  const battle = useSyncExternalStore(
    Battle.watch,
    () => Battle.active,
    () => null,
  );
  const view = useSyncExternalStore(
    battle?.subscribe ?? noop,
    () => battle?.view ?? null,
    () => null,
  );
  if (!battle || !view) {
    return null;
  }
  //The scene's tints also fall on the platforms (through --tint), not on the Pokémon
  //Caves and rooms have no sky: only the time of day outdoors tints them
  const outdoors = !session.area || typeOf(session.area, session.city) === "outdoor";
  const overlays = [outdoors ? hour(session.area?.time) : "", session.area?.weather].filter((key) => key && tints[key]) as string[];
  const tint = overlays.map((key) => `linear-gradient(${tints[key]}, ${tints[key]})`).join(", ") || "none";
  //The map's own battle background, else the outside map's (the city default), else the built-in scene
  const chosen = session.area?.battle ?? session.city?.battle;
  //The battle's own Emerald scene, the map's (chosen, or picked by the kind of place), or an uploaded picture
  const scene = battle.scene ?? (chosen ? sceneOf(chosen.image) : session.area ? autoScene(session.area, session.city, { water: battle.water }) : "tall_grass");
  const background = scene ? { image: scenePicture(scene), platforms: false } : chosen!;
  return (
    <div className={cn("battle", view.phase === "intro" && "intro", view.phase === "outro" && "outro")}>
      <div className="flash" />
      <div
        className={cn("stage", scene ? "gen3" : background.platforms ? "picture" : "bare", battle.double && "double")}
        style={{ ["--tint" as string]: tint }}
      >
        <Scene overlays={overlays} picture={background.image} scene={scene} />
        <div className="arena">
          <Side side="foe" view={view.foe} foe />
          {view.foe2 ? <Side side="foe2" view={view.foe2} foe /> : null}
          <Side side="ally" view={view.ally} foe={false} />
          {view.ally2 ? <Side side="ally2" view={view.ally2} foe={false} /> : null}
          <Info view={view.foe} foe slot="foe" />
          {view.foe2 ? <Info view={view.foe2} foe slot="foe2" /> : null}
          <Info view={view.ally} foe={false} slot="ally" />
          {view.ally2 ? <Info view={view.ally2} foe={false} slot="ally2" /> : null}
          {view.slide ? (
            <div key={view.slide.key} className="slide" aria-hidden="true">
              <CanvasView make={() => preview(texture(view.slide!.sprite, "down"), 6 * scaleOf(view.slide!.sprite))} deps={[view.slide.sprite]} />
            </div>
          ) : null}
        </div>
      </div>
      <div className="panel">
        <div className="log">{view.log}</div>
        <div className="menu" style={{ gridTemplateColumns: `repeat(${view.menu?.columns ?? 2}, 1fr)` }}>
          {view.menu?.choices.map(({ label, detail, color, disabled }, i) => (
            <button
              key={i}
              className="action"
              disabled={disabled}
              style={color ? { ["--accent" as string]: color } : undefined}
              onClick={() => battle.choose(i)}
            >
              <b>{label}</b>
              {/^\d+$/.test(detail) ? null : <small>{detail}</small>}
            </button>
          ))}
        </div>
      </div>
      {view.anim ? <Attack key={view.anim.key} anim={view.anim} /> : null}
      {view.ball ? <div key={view.ball.key} className={`pokeball ${view.ball.state}`} /> : null}
    </div>
  );
}
const noop = () => () => {};

//=================================================================================================
// Play mode helpers

/** On-screen gamepad for touch devices */
export function Gamepad() {
  const session = useSession();
  const press = (dir: "up" | "down" | "left" | "right" | "action", down: boolean) => (event: React.PointerEvent) => {
    event.preventDefault();
    session.play?.press(dir, down);
  };
  const pad = (dir: "up" | "down" | "left" | "right" | "action", label: string) => (
    <button className={`pad-${dir}`} onPointerDown={press(dir, true)} onPointerUp={press(dir, false)} onPointerLeave={press(dir, false)}>
      {label}
    </button>
  );
  return (
    <div className="gamepad" data-active={session.mode === "play" ? "" : undefined}>
      <div className="dpad">
        {pad("up", "▲")}
        {pad("left", "◀")}
        {pad("right", "▶")}
        {pad("down", "▼")}
      </div>
      {pad("action", "A")}
    </div>
  );
}

//=================================================================================================
// Story and quest banners

let banners = [] as (Banner & { key: number })[];
const bannerListeners = new Set<() => void>();
const subscribeBanners = (listener: () => void) => (bannerListeners.add(listener), () => void bannerListeners.delete(listener));
let bannerKey = 0;

/** Show a banner at the top of the screen for a moment (they queue up) */
export function banner(next: Banner) {
  banners = [...banners, { ...next, key: ++bannerKey }];
  bannerListeners.forEach((listener) => listener());
}

/** Story progress and quests: "New quest: Lost kitten", "Next: Find the Professor" */
export function QuestBanner() {
  const queued = useSyncExternalStore(
    subscribeBanners,
    () => banners,
    () => banners,
  );
  const current = queued[0];
  useEffect(() => {
    if (!current) {
      return;
    }
    const timer = setTimeout(
      () => {
        banners = banners.slice(1);
        bannerListeners.forEach((listener) => listener());
      },
      current.kind === "place" ? 2400 : 3600,
    );
    return () => clearTimeout(timer);
  }, [current]);
  if (!current) {
    return null;
  }
  return (
    <div key={current.key} role="status" className={cn("quest-banner", current.kind === "place" && "place")}>
      {current.kind === "place" ? null : <span className="kind">{current.kind === "quest" ? "Side quest" : "Story"}</span>}
      <span className="title">{current.title}</span>
      {current.text ? <span className="text">{current.text}</span> : null}
    </div>
  );
}

/** Black fade while walking through a door */
export function Fade() {
  const session = useSession();
  return session.fading ? <div className="pointer-events-none fixed inset-0 z-40 bg-black animate-[door-fade_0.6s_ease_forwards]" /> : null;
}

/** Banner while placing a blocker or drawing a path */
export function MapBanner() {
  const editor = useEditor();
  if (!editor) {
    return null;
  }
  const step = editor.blocking ? editor.city.story.find(({ id }) => id === editor.blocking) : null;
  const drawing = editor.pathing >= 0;
  if (!step && !drawing) {
    return null;
  }
  return (
    <div
      role="status"
      className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg"
    >
      {step ? <Users size={15} className="text-select" /> : <Eyedropper size={15} className="text-select" />}
      <span>{step ? `Click on the map where they should stand to block “${step.name}”` : "Click tiles to add stops to the path"}</span>
      <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
      <Button size="sm" className="h-7 rounded-full" onClick={() => (step ? editor.stopBlocking() : editor.stopPath())}>
        {step ? "Cancel" : "Done"}
      </Button>
    </div>
  );
}

/** Reminder to log in after building a while logged out (a toast, once per visit) */
export function SaveNudge({ onLogin }: { onLogin: () => void }) {
  const session = useSession();
  const due = cloud.available && !cloud.user && session.edits >= 40;
  useEffect(() => {
    if (!due || sessionStorage.getItem("dreammist.reminded")) {
      return;
    }
    sessionStorage.setItem("dreammist.reminded", "1");
    toast.warning("Your town only lives in this browser", {
      id: "save-nudge",
      description: "Clearing your browser data or switching devices would lose it. Log in to keep it safe.",
      duration: Infinity,
      action: { label: "Log in", onClick: onLogin },
    });
  }, [due, onLogin]);
  //Logging in some other way makes the reminder pointless
  useEffect(() => {
    if (cloud.user) {
      toast.dismiss("save-nudge");
    }
  });
  return null;
}
