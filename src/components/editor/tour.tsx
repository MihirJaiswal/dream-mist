"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { useSpeaker } from "@/components/editor/overlays";
import { share } from "@/components/editor/share-dialogs";
import { brushes } from "@/game/brushes";
import { library, type Npc, storage } from "@/game/data";
import { trainer } from "@/game/trainer";
import { cn } from "@/lib/utils";
import { useEffect, useState, useSyncExternalStore } from "react";

//=================================================================================================
// Opening the tour

/** Tour state: open or not, shared with the city menu */
let open = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));
const setOpen = (value: boolean) => ((open = value), listeners.forEach((listener) => listener()));

/** Start the getting started tour (city menu) */
export function startTour() {
  storage.set("tour", "");
  setOpen(true);
}

/** Brand new players see the tour on their first visit: no trainer yet, and at most the starter town saved */
function firstVisit() {
  return storage.get("tour", "") === "" && !trainer.exists && library.list().length <= 1;
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
  const shown = useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
  const [start, setStart] = useState<null | Start>(null);
  const [talked, setTalked] = useState(false);
  //Folded down to its header, to see more of the map
  const [small, setSmall] = useState(false);

  //Open by itself once for new players
  useEffect(() => {
    if (session.ready && !session.visiting && firstVisit()) {
      setOpen(true);
    }
  }, [session.ready, session.visiting]);

  //Remember the town as it was when the tour opened
  if (shown && !start && session.ready) {
    setStart({ name: session.city.name, ground: [...session.city.layers.ground], npcs: new Set(session.city.npcs) });
  }
  if (!shown && start) {
    setStart(null);
    setTalked(false);
  }
  if (!shown || !start || !editor || session.visiting) {
    return null;
  }

  //Progress, read from the town itself
  const city = session.city;
  const added = city.npcs.filter((npc) => !start.npcs.has(npc));
  const speaking = added.find((npc) => npc.dialogue.trim() && !defaults.includes(npc.dialogue.trim()) && npc.dialogue.trim() !== `Welcome to ${city.name}!`);
  const friend = speaking ?? added[0];
  const painted = city.layers.ground.filter((value, i) => value !== start.ground[i]).length;
  if (!talked && session.mode === "play" && friend && speaker === friend.name) {
    setTalked(true);
  }

  const close = (result: "done" | "skipped") => (storage.set("tour", result), setOpen(false));
  const build = async () => (session.mode === "edit" ? undefined : await session.setMode("edit"));
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
        requestAnimationFrame(() =>
          [...document.querySelectorAll("label")]
            .find(({ textContent }) => textContent === "Dialogue")
            ?.closest("div.grid")
            ?.querySelector("textarea")
            ?.focus(),
        );
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
  const ready = (index: number) => index < 3 || (index === 3 ? added.length > 0 : Boolean(speaking));

  return (
    <section
      aria-label="Getting started"
      className="absolute bottom-3 left-3 z-20 w-[min(20rem,calc(100%-1.5rem))] border-4 border-[#0b0616] bg-[#1d1038] text-white shadow-[inset_0_4px_0_#3f2c74,6px_6px_0_#0b0616]"
    >
      <div className="h-1.5 bg-[#f06aa6]" aria-hidden="true" />
      <header className="flex items-center gap-3 px-3 pt-3">
        {/* The dream potion (its black background melts into the panel) */}
        <img src="/site/potion.avif" alt="" width={56} height={63} className="pixelated float h-16 w-auto shrink-0 mix-blend-screen" />
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-[10px] uppercase tracking-wide text-[#f06aa6]">Trainer guide</p>
          <b className="block font-pixel text-[14px] leading-snug font-normal">{current < 0 ? "You made a game!" : "Your first game"}</b>
          <span className="font-game text-[12px] text-[#9b8cc9]">
            {count} of {steps.length} done
          </span>
        </div>
        <div className="flex shrink-0 gap-1 self-start">
          <button
            aria-label={small ? "Show the steps" : "Hide the steps"}
            title={small ? "Show the steps" : "Hide the steps"}
            onClick={() => setSmall(!small)}
            className="stepped grid size-7 place-items-center bg-[#0b0616]/60 font-pixel text-[12px] text-[#c9b8f5] hover:text-white"
          >
            {small ? "+" : "−"}
          </button>
          <button
            aria-label="Close the guide"
            title="Close the guide"
            onClick={() => close(current < 0 ? "done" : "skipped")}
            className="stepped grid size-7 place-items-center bg-[#0b0616]/60 font-pixel text-[12px] text-[#c9b8f5] hover:text-white"
          >
            ✕
          </button>
        </div>
      </header>
      {/* One block per step, filled pink when done */}
      <div className="mx-3 mt-3 grid grid-cols-5 gap-1" aria-hidden="true">
        {steps.map(({ title, done }) => (
          <span key={title} className={cn("h-2", done ? "bg-[#f06aa6]" : "bg-[#0b0616]")} />
        ))}
      </div>
      {small ? (
        <div className="h-3" />
      ) : current < 0 ? (
        <div className="grid gap-3 p-3">
          <p className="font-game text-[14px] leading-relaxed text-[#c9b8f5]">
            Someone in your town now talks to visitors. Share it with a friend, or keep building: add a house, a trainer, or a story.
          </p>
          <div className="flex gap-2">
            <button onClick={() => (close("done"), share())} className={cn(action, "flex-1 bg-[#f06aa6] text-[#2a0a1e]")}>
              Share it
            </button>
            <button onClick={async () => (close("done"), await build())} className={cn(action, "flex-1 bg-[#b9a6ff] text-[#1c1240]")}>
              Keep building
            </button>
          </div>
        </div>
      ) : (
        <ol className="grid gap-1 p-3">
          {steps.map((step, index) => (
            <li key={step.title} className={cn("border-l-4 px-2.5 py-2", index === current ? "border-[#f06aa6] bg-[#2a1a50]" : "border-transparent")}>
              <div className="flex items-center gap-2.5">
                {/* A Poké Ball for each step: caught when done, wobbling for the one to do now */}
                <img
                  src="/site/sprites/ball-poke.png"
                  alt=""
                  width={16}
                  height={16}
                  className={cn("pixelated size-5 shrink-0", !step.done && index !== current && "opacity-30 grayscale", index === current && "tour-wobble")}
                />
                <span className={cn("font-game text-[14px]", step.done ? "text-[#9b8cc9] line-through" : index === current ? "text-white" : "text-[#9b8cc9]")}>
                  {step.title}
                </span>
              </div>
              {index === current ? (
                <div className="mt-2 flex items-center gap-2 pl-[30px]">
                  <p className="flex-1 font-game text-[12px] leading-snug text-[#c9b8f5]">{step.hint}</p>
                  {ready(index) ? (
                    <button onClick={() => void step.show()} className={cn(action, "shrink-0 bg-[#f06aa6] px-2.5 py-1.5 text-[10px] text-[#2a0a1e]")}>
                      Show me
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Chunky pixel button of the guide */
const action =
  "border-[3px] border-[#0b0616] px-3 py-2 font-pixel text-[11px] uppercase tracking-wide shadow-[3px_3px_0_#0b0616] transition-[translate,box-shadow] duration-100 ease-[steps(2)] hover:-translate-y-0.5 hover:shadow-[3px_5px_0_#0b0616]";
