"use client";

import { bag, party } from "@/components/editor/gba-screens";
import { card, journalDialog, pokedex, townMap } from "@/components/editor/trainer-dialogs";
import { trainer } from "@/game/trainer";
import { cn } from "@/lib/utils";
import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

/** Start menu, like the Game Boy Advance games: opened with Enter in play mode, closed with X, Escape or EXIT */
let pending = null as null | (() => void);
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));
const emit = () => listeners.forEach((listener) => listener());

/** Open the start menu, resolves when it closes */
export function menu() {
  return new Promise<void>((done) => {
    pending?.();
    pending = done;
    emit();
  });
}

/** Close it (an Escape Rope used from its bag closes it too) */
export function close() {
  const done = pending;
  pending = null;
  emit();
  done?.();
}

/** Entries, in the games' order (EXIT closes the menu) */
function entries() {
  const name = (trainer.profile?.name ?? "Trainer").toUpperCase();
  return [
    { label: "POKéDEX", open: pokedex },
    { label: "POKéMON", open: () => party() },
    { label: "BAG", open: () => bag() },
    { label: "POKéNAV", open: townMap },
    { label: name, open: card },
    { label: "JOURNAL", open: journalDialog },
    {
      label: "SAVE",
      open: async () => {
        trainer.save();
        toast.success(`${trainer.profile?.name ?? "You"} saved the game.`);
      },
    },
    { label: "EXIT", open: null },
  ];
}

export function StartMenu() {
  const open = useSyncExternalStore(
    subscribe,
    () => Boolean(pending),
    () => false,
  );
  const [picked, setPicked] = useState(0);
  //Hidden while one of its windows is open, back when it closes
  const [away, setAway] = useState(false);
  const list = entries();
  const choose = async (index: number) => {
    const { open } = list[index];
    if (!open) {
      return close();
    }
    setAway(true);
    await open();
    setAway(false);
  };
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (away) {
      return;
    }
    const key = event.key.toLowerCase();
    const handled = ["arrowup", "arrowdown", "w", "s", "x", "escape", " ", "enter", "z", "e"];
    if (!handled.includes(key)) {
      return;
    }
    //No other listener hears it: the window this key opens must not get it too
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat && !["arrowup", "arrowdown", "w", "s"].includes(key)) {
      return;
    }
    if (key === "x" || key === "escape") {
      return close();
    }
    if (["arrowup", "arrowdown", "w", "s"].includes(key)) {
      return setPicked((current) => (current + (key === "arrowdown" || key === "s" ? 1 : list.length - 1)) % list.length);
    }
    void choose(picked);
  });
  useEffect(() => {
    if (!open) {
      return;
    }
    const keys = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", keys, true);
    return () => document.removeEventListener("keydown", keys, true);
  }, [open]);
  if (!open || away) {
    return null;
  }
  return (
    <div className="game-menu" role="menu" aria-label="Menu">
      {list.map(({ label }, i) => (
        <button key={label} role="menuitem" className={cn(i === picked && "picked")} onMouseEnter={() => setPicked(i)} onClick={() => void choose(i)}>
          {label}
        </button>
      ))}
    </div>
  );
}
