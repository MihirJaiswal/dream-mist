"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { useSpeaker } from "@/components/editor/overlays";
import { share } from "@/components/editor/share-dialogs";
import { Button } from "@/components/ui/button";
import { brushes } from "@/game/brushes";
import { library, type Npc, storage } from "@/game/data";
import { trainer } from "@/game/trainer";
import { cn } from "@/lib/utils";
import { CheckCircle, Circle, Sparkle, X } from "@phosphor-icons/react";
import { useEffect, useState, useSyncExternalStore } from "react";

//=================================================================================================
// Opening the tour

/** Tour state: open or not, shared with the city menu */
let open = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));
const setOpen = (value: boolean) => (open = value, listeners.forEach((listener) => listener()));

/** Start the getting started tour (city menu) */
export function startTour() {
  storage.set("tour", "");
  setOpen(true);
}

/** Brand new players see the tour on their first visit: no trainer yet, and at most the starter town saved */
function firstVisit() {
  return (storage.get("tour", "") === "") && (!trainer.exists) && (library.list().length <= 1);
}

//=================================================================================================
// Steps

/** What new people and Pokémon say before you change it */
const defaults = ["Welcome to our town!", "Pika pika!"];

/** Town at the start of the tour, to notice what changed */
type Start = { name: string; ground: number[]; npcs: Set<Npc> };

/** Guided first build: name the town, paint a path, add someone, give them a line, then play and talk to them */
export function Tour() {
  const session = useSession();
  const editor = useEditor();
  const speaker = useSpeaker();
  const shown = useSyncExternalStore(subscribe, () => open, () => false);
  const [start, setStart] = useState<null | Start>(null);
  const [talked, setTalked] = useState(false);

  //Open by itself once for new players
  useEffect(() => {
    if ((session.ready) && (!session.visiting) && (firstVisit())) {
      setOpen(true);
    }
  }, [session.ready, session.visiting]);

  //Remember the town as it was when the tour opened
  if ((shown) && (!start) && (session.ready)) {
    setStart({ name: session.city.name, ground: [...session.city.layers.ground], npcs: new Set(session.city.npcs) });
  }
  if ((!shown) && (start)) {
    setStart(null);
    setTalked(false);
  }
  if ((!shown) || (!start) || (!editor) || (session.visiting)) {
    return null;
  }

  //Progress, read from the town itself
  const city = session.city;
  const added = city.npcs.filter((npc) => !start.npcs.has(npc));
  const speaking = added.find((npc) => (npc.dialogue.trim()) && (!defaults.includes(npc.dialogue.trim())) && (npc.dialogue.trim() !== `Welcome to ${city.name}!`));
  const friend = speaking ?? added[0];
  const painted = city.layers.ground.filter((value, i) => value !== start.ground[i]).length;
  if ((!talked) && (session.mode === "play") && (friend) && (speaker === friend.name)) {
    setTalked(true);
  }

  const close = (result: "done" | "skipped") => (storage.set("tour", result), setOpen(false));
  const build = async () => session.mode === "edit" ? undefined : await session.setMode("edit");
  const steps = [
    {
      title: "Name your town",
      done: city.name !== start.name,
      hint: "Click the name at the top left and type a new one.",
      show: async () => {
        await build();
        const input = document.querySelector<HTMLInputElement>("[aria-label='City name']");
        input?.focus();
        input?.select();
      },
    },
    {
      title: "Paint a path",
      done: painted >= 3,
      hint: "Drag across the map with the Sand path brush.",
      show: async () => (await build(), editor.use(brushes.find(({ name }) => name === "Sand path")!)),
    },
    {
      title: "Add someone",
      done: added.length > 0,
      hint: "On the People layer, click an empty tile on the map.",
      show: async () => (await build(), editor.select("npc"), editor.setAdding("person")),
    },
    {
      title: "Give them a line",
      done: Boolean(speaking),
      hint: "Type what they say in the Dialogue box of the side panel.",
      show: async () => {
        await build();
        editor.select("npc");
        editor.selectNpc(city.npcs.indexOf(friend!));
        //Focus the Dialogue box once the panel shows them
        requestAnimationFrame(() => [...document.querySelectorAll("label")].find(({ textContent }) => textContent === "Dialogue")?.closest("div.grid")?.querySelector("textarea")?.focus());
      },
    },
    {
      title: "Play and talk to them",
      done: talked,
      hint: "Walk up to them and press Space.",
      show: () => {
        //Start right below them, facing up
        const below = { x: friend!.x, y: friend!.y + 1 };
        return session.playFrom(session.map.inside(below) ? below : null);
      },
    },
  ];
  const current = steps.findIndex(({ done }) => !done);
  const count = steps.filter(({ done }) => done).length;
  //A step needs the ones before it (you can't talk to someone you haven't added)
  const ready = (index: number) => (index < 3) || (index === 3 ? added.length > 0 : Boolean(speaking));

  return (
    <section aria-label="Getting started" className="absolute bottom-3 left-3 z-20 w-72 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
      <header className="mb-2 flex items-center gap-2">
        <Sparkle size={16} weight="fill" className="text-select" />
        <b className="flex-1 text-sm">{current < 0 ? "You made a game!" : "Your first game"}</b>
        <span className="font-mono text-[11px] text-subtle-fg">{count} / {steps.length}</span>
        <button aria-label="Close the tour" title="Close the tour" onClick={() => close(current < 0 ? "done" : "skipped")} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><X size={13} /></button>
      </header>
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-select transition-[width]" style={{ width: `${(count / steps.length) * 100}%` }} /></div>
      {current < 0
        ? (
          <div className="grid gap-2">
            <p className="text-xs leading-relaxed text-muted-foreground">Someone in your town now talks to visitors. Share it with a friend, or keep building: add a house, a trainer, or a story.</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => (close("done"), share())}>Share it</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={async () => (close("done"), await build())}>Keep building</Button>
            </div>
          </div>
        )
        : (
          <ol className="grid gap-1">
            {steps.map((step, index) => (
              <li key={step.title} className={cn("rounded-md px-2 py-1.5", index === current && "bg-muted")}>
                <div className="flex items-center gap-2 text-sm">
                  {step.done ? <CheckCircle size={16} weight="fill" className="shrink-0 text-success" /> : <Circle size={16} className="shrink-0 text-subtle-fg" />}
                  <span className={cn(step.done ? "text-muted-foreground line-through" : index === current ? "text-foreground" : "text-muted-foreground")}>{step.title}</span>
                </div>
                {index === current
                  ? (
                    <div className="mt-1.5 flex items-center gap-2 pl-6">
                      <p className="flex-1 text-[11px] leading-snug text-muted-foreground">{step.hint}</p>
                      {ready(index) ? <Button size="sm" variant="secondary" className="h-7 shrink-0 px-2 text-xs" onClick={() => void step.show()}>Show me</Button> : null}
                    </div>
                  )
                  : null}
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
