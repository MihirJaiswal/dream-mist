"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { Button } from "@/components/ui/button";
import { artwork, battleSprite } from "@/game/assets";
import { Battle, type BattleSide, statusLabels } from "@/game/battle";
import { cloud } from "@/game/cloud";
import { session } from "@/game/session";
import { hp, named } from "@/game/trainer";
import type { Banner, Portrait } from "@/game/ui-bridge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Eyedropper, Users } from "@phosphor-icons/react";
import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";

//=================================================================================================
// Dialogue box

type Line = { text: string; speaker: string; portrait?: Portrait; done: () => void };
let queue = [] as Line[];
const lineListeners = new Set<() => void>();
const emitLines = () => lineListeners.forEach((listener) => listener());

/** Show a dialogue (blank lines split pages), resolves when the player dismisses the last page */
export function say(text: string, { speaker = "", portrait }: { speaker?: string; portrait?: Portrait } = {}) {
  return new Promise<void>((done) => {
    queue = [...queue, { text, speaker, portrait, done }];
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
  const lines = useSyncExternalStore(subscribeLines, () => queue, () => queue);
  return lines[0]?.speaker ?? "";
}

/** Game dialogue box: types each page, Space/Enter/Z/E or a click continues */
export function DialogueBox() {
  const lines = useSyncExternalStore(subscribeLines, () => queue, () => queue);
  const line = lines[0];
  const pages = line ? line.text.split(/\n\s*\n/).map((page) => page.trim()).filter(Boolean) : [];
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  //Start over on a new line, and type again on a new page
  const [at, setAt] = useState<{ line?: Line; page: number }>({ page: 0 });
  if (at.line !== line) {
    setAt({ line, page: 0 });
    setPage(0);
    setShown(0);
  } else if (at.page !== page) {
    setAt({ line, page });
    setShown(0);
  }
  const text = pages[page] ?? "";
  useEffect(() => {
    const timer = setInterval(() => setShown((count) => count >= text.length ? (clearInterval(timer), count) : count + 1), 18);
    return () => clearInterval(timer);
  }, [text, line, page]);
  //Continue: finish typing, then next page, then close
  const advance = () => {
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
    line.done();
  };
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if ([" ", "enter", "z", "e"].includes(event.key.toLowerCase()) && !event.repeat) {
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
    <div className="game-dialogue" role="dialog" aria-live="polite" aria-label={line.speaker || "Message"} onClick={advance}>
      {line.portrait ? <img key={line.portrait.src} className={cn("portrait", line.portrait.kind)} src={line.portrait.src} alt="" draggable={false} /> : null}
      <div className="box">
        {line.speaker ? <div className="speaker">{line.speaker}</div> : null}
        {/* The full page is laid out invisibly so the box doesn't grow while typing */}
        <div className="text"><span>{text.slice(0, shown)}</span><span className="rest" aria-hidden="true">{text.slice(shown)}</span></div>
        {typing ? null : <div className={cn("next", page < pages.length - 1 ? "more" : "end")} aria-hidden="true" />}
      </div>
    </div>
  );
}

//=================================================================================================
// Battle

/** One side of the battle */
/** Battle background tints for the map's time of day and weather (the Pokémon keep their colors) */
const tints: Record<string, string> = { evening: "rgb(255 106 32 / 0.22)", night: "rgb(11 24 64 / 0.5)", rain: "rgb(80 112 160 / 0.18)", fog: "rgb(223 230 236 / 0.35)", sandstorm: "rgb(200 160 96 / 0.25)", snow: "rgb(220 235 255 / 0.18)" };

/** Where the battle happens: the map's uploaded background, or the built-in scene (sky, trees and grass outdoors, wall and floor indoors), tinted by the map's time and weather */
function Scene({ overlays, picture }: { overlays: string[]; picture?: string }) {
  const area = session.area;
  const indoor = (Boolean(area)) && (area !== session.city) && (!area.outdoor);
  return (
    <div className={cn("scene", indoor ? "indoor" : "field", area?.time === "night" && "night")} aria-hidden="true">
      {picture
        ? <div className="picture" style={{ backgroundImage: `url("${picture}")` }} />
        : (
          <>
            <div className="sky" />
            {indoor ? null : <div className="treeline" />}
            <div className="ground" />
          </>
        )}
      {overlays.map((key) => <div key={key} className="tint" style={{ background: tints[key] }} />)}
    </div>
  );
}

/** Info box: name, level, condition, HP (and experience for your Pokémon) */
function Info({ view, foe }: { view: BattleSide; foe: boolean }) {
  const creature = view.creature;
  const ratio = Math.max(0, creature.hp) / hp(creature);
  const start = creature.level ** 3, end = (creature.level + 1) ** 3;
  return (
    <div className={cn("infobox", foe ? "foe" : "ally")} style={{ visibility: view.info ? "visible" : "hidden" }}>
      <div className="row"><b>{named(creature)}{creature.shiny ? " ✨" : ""}</b><span>{creature.status ? <span className="status" style={{ background: statusLabels[creature.status].color }}>{statusLabels[creature.status].label}</span> : null}Lv{creature.level}</span></div>
      <div className="hp"><small>HP</small><div className="bar"><div className="fill" style={{ width: `${ratio * 100}%`, background: ratio > 0.5 ? "#48d058" : ratio > 0.2 ? "#f8c030" : "#f05038" }} /></div></div>
      {foe ? null : <div className="row small"><span className="hptext">{Math.max(0, creature.hp)} / {hp(creature)}</span><div className="exp"><div className="fill" style={{ width: `${Math.min(1, (creature.exp - start) / (end - start)) * 100}%` }} /></div></div>}
    </div>
  );
}

/** A Pokémon standing on its platform: animated battle sprite at a whole-pixel size, the still artwork if it can't load */
function Side({ side, view, foe }: { side: "ally" | "foe"; view: BattleSide; foe: boolean }) {
  const creature = view.creature;
  const sprite = battleSprite(creature.species, { back: !foe, shiny: creature.shiny });
  const [failed, setFailed] = useState("");
  const custom = Boolean(creature.art);
  const still = custom || failed === sprite.src;
  return (
    <div className={`side ${side}`}>
      <div className="platform" />
      <div className="stand">
        <img
          key={`${view.entered}:${view.fxKey}`}
          className={cn("mon", still ? "still" : sprite.animated ? "animated" : "big", view.fx, view.entered && !view.fx ? "enter" : "")}
          alt=""
          draggable={false}
          src={custom ? creature.art : still ? artwork(creature.species, { back: !foe, shiny: creature.shiny }) : sprite.src}
          onError={() => setFailed(sprite.src)}
          style={{ scale: (custom) && (!foe) ? "-1 1" : undefined }}
        />
      </div>
    </div>
  );
}

/** Battle scene of the running battle */
export function BattleScreen() {
  const battle = useSyncExternalStore(Battle.watch, () => Battle.active, () => null);
  const view = useSyncExternalStore(battle?.subscribe ?? noop, () => battle?.view ?? null, () => null);
  if ((!battle) || (!view)) {
    return null;
  }
  //The scene's tints also fall on the platforms (through --tint), not on the Pokémon
  const overlays = [session.area?.time, session.area?.weather].filter((key) => (key) && (tints[key])) as string[];
  const tint = overlays.map((key) => `linear-gradient(${tints[key]}, ${tints[key]})`).join(", ") || "none";
  //The map's own battle background, else the outside map's (the city default), else the built-in scene
  const background = session.area?.battle ?? session.city?.battle;
  return (
    <div className={cn("battle", view.phase === "intro" && "intro", view.phase === "outro" && "outro")}>
      <div className="flash" />
      <div className={cn("stage", (background) && (background.platforms ? "picture" : "bare"))} style={{ ["--tint" as string]: tint }}>
        <Scene overlays={overlays} picture={background?.image} />
        <div className="arena">
          <Side side="foe" view={view.foe} foe />
          <Side side="ally" view={view.ally} foe={false} />
          <Info view={view.foe} foe />
          <Info view={view.ally} foe={false} />
        </div>
      </div>
      <div className="panel">
        <div className="log">{view.log}</div>
        <div className="menu" style={{ gridTemplateColumns: `repeat(${view.menu?.columns ?? 2}, 1fr)` }}>
          {view.menu?.choices.map(({ label, detail, color, disabled }, i) => (
            <button key={i} className="action" disabled={disabled} style={color ? { ["--accent" as string]: color } : undefined} onClick={() => battle.choose(i)}><b>{label}</b><small>{detail}</small></button>
          ))}
        </div>
      </div>
      {view.orb ? <div key={view.orb.key} className={`orb from-${view.orb.from}`} style={{ ["--accent" as string]: view.orb.color }} /> : null}
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
  const pad = (dir: "up" | "down" | "left" | "right" | "action", label: string) => <button className={`pad-${dir}`} onPointerDown={press(dir, true)} onPointerUp={press(dir, false)} onPointerLeave={press(dir, false)}>{label}</button>;
  return (
    <div className="gamepad" data-active={session.mode === "play" ? "" : undefined}>
      <div className="dpad">{pad("up", "▲")}{pad("left", "◀")}{pad("right", "▶")}{pad("down", "▼")}</div>
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
  const queued = useSyncExternalStore(subscribeBanners, () => banners, () => banners);
  const current = queued[0];
  useEffect(() => {
    if (!current) {
      return;
    }
    const timer = setTimeout(() => {
      banners = banners.slice(1);
      bannerListeners.forEach((listener) => listener());
    }, current.kind === "place" ? 2400 : 3600);
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
  if ((!step) && (!drawing)) {
    return null;
  }
  return (
    <div role="status" className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg">
      {step ? <Users size={15} className="text-select" /> : <Eyedropper size={15} className="text-select" />}
      <span>{step ? `Click on the map where they should stand to block “${step.name}”` : "Click tiles to add stops to the path"}</span>
      <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
      <Button size="sm" className="h-7 rounded-full" onClick={() => step ? editor.stopBlocking() : editor.stopPath()}>{step ? "Cancel" : "Done"}</Button>
    </div>
  );
}

/** Reminder to log in after building a while logged out (a toast, once per visit) */
export function SaveNudge({ onLogin }: { onLogin: () => void }) {
  const session = useSession();
  const due = (cloud.available) && (!cloud.user) && (session.edits >= 40);
  useEffect(() => {
    if ((!due) || (sessionStorage.getItem("dreammist.reminded"))) {
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
