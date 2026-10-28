"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { Button } from "@/components/ui/button";
import { artwork } from "@/game/assets";
import { Battle, type BattleSide } from "@/game/battle";
import { cloud } from "@/game/cloud";
import { hp, named } from "@/game/trainer";
import type { Portrait } from "@/game/ui-bridge";
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

/** Game dialogue box: types each page, Space/Enter/Z/E or a click continues */
export function DialogueBox() {
  const lines = useSyncExternalStore((listener) => (lineListeners.add(listener), () => void lineListeners.delete(listener)), () => queue, () => queue);
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
function Side({ side, view, foe }: { side: "ally" | "foe"; view: BattleSide; foe: boolean }) {
  const creature = view.creature;
  const ratio = Math.max(0, creature.hp) / hp(creature);
  const start = creature.level ** 3, end = (creature.level + 1) ** 3;
  const info = (
    <div className="infobox" style={{ visibility: view.info ? "visible" : "hidden" }}>
      <div className="row"><b>{named(creature)}{creature.shiny ? " ✨" : ""}</b><span>Lv{creature.level}</span></div>
      <div className="hp"><small>HP</small><div className="bar"><div className="fill" style={{ width: `${ratio * 100}%`, background: ratio > 0.5 ? "#48d058" : ratio > 0.2 ? "#f8c030" : "#f05038" }} /></div></div>
      {foe ? null : <div className="row small"><span className="hptext">{Math.max(0, creature.hp)} / {hp(creature)}</span><div className="exp"><div className="fill" style={{ width: `${Math.min(1, (creature.exp - start) / (end - start)) * 100}%` }} /></div></div>}
    </div>
  );
  return (
    <div className={`side ${side}`}>
      {foe ? info : null}
      <div className="platform" />
      <img
        key={`${view.entered}:${view.fxKey}`}
        className={cn("mon", view.fx, view.entered && !view.fx ? "enter" : "")}
        alt=""
        draggable={false}
        src={creature.art || artwork(creature.species, { back: !foe, shiny: creature.shiny })}
        style={{ scale: (creature.art) && (!foe) ? "-1 1" : undefined }}
      />
      {foe ? null : info}
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
  return (
    <div className={cn("battle", view.phase === "intro" && "intro", view.phase === "outro" && "outro")}>
      <div className="flash" />
      <div className="arena">
        <Side side="foe" view={view.foe} foe />
        <Side side="ally" view={view.ally} foe={false} />
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
