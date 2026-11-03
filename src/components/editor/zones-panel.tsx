"use client";

import { useEditor } from "@/components/editor/hooks";
import { SpeciesInput } from "@/components/editor/pokemon-picker";
import { CanvasView, Hint, NumberInput, TextInput, Tip, useDraft } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { assets, portrait, species } from "@/game/assets";
import type { Wild, Zone } from "@/game/data";
import { type Habitat, habitats, methodOf } from "@/game/encounters";
import { openDialog } from "@/components/editor/dialogs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { session } from "@/game/session";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MagnifyingGlass, Plus, X } from "@phosphor-icons/react";

/** Encounter rate slider (saves when released) */
function Rate({ zone, onCommit }: { zone: Zone; onCommit: (rate: number) => void }) {
  const [value, setValue] = useDraft(Math.round(zone.rate * 100));
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="w-24 shrink-0">Encounter rate</span>
      <Slider
        min={1}
        max={40}
        step={1}
        value={[value]}
        onValueChange={([next]) => setValue(next)}
        onValueCommit={([next]) => onCommit(next / 100)}
        className="flex-1"
        aria-label="Encounter rate"
      />
      <span className="w-8 text-right font-mono tabular-nums text-foreground">{value}%</span>
    </div>
  );
}

/** How Pokémon of a zone are met */
const methods = [
  { key: "walk", label: "Walking", hint: "Met walking on the zone's tiles: tall grass, caves, sand" },
  { key: "surf", label: "Surfing", hint: "Met surfing on the zone's water" },
  { key: "fish", label: "Fishing", hint: "Hooked with a rod, facing the zone's water" },
] as const;

/** One wild Pokémon: species, levels, part of the day, and the rod for fishing */
function Creature({ zone, creature }: { zone: Zone; creature: Wild }) {
  const editor = useEditor();
  const set = (patch: Partial<Wild>) =>
    editor.mutate(() => {
      Object.assign(creature, patch);
      for (const key of ["time", "rod"] as const) {
        if (!creature[key]) {
          delete creature[key];
        }
      }
    });
  return (
    <div className="grid min-w-0 gap-1 rounded-md bg-muted/40 p-1.5">
      <div className="flex items-center gap-1.5">
        <SpeciesInput value={creature.species} onChange={(id) => set({ species: id })} />
        <button
          aria-label="Remove Pokémon"
          title="Remove Pokémon"
          onClick={() => editor.mutate(() => zone.creatures.splice(zone.creatures.indexOf(creature), 1))}
          className="grid size-7 shrink-0 place-items-center rounded text-subtle-fg hover:text-destructive"
        >
          <X size={13} />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-subtle-fg">Lv</span>
        <NumberInput aria-label="Lowest level" value={creature.min} onCommit={(value) => set({ min: value })} className="h-7 w-12 shrink-0" />
        <span className="text-subtle-fg">–</span>
        <NumberInput aria-label="Highest level" value={creature.max} onCommit={(value) => set({ max: value })} className="h-7 w-12 shrink-0" />
        <Select value={creature.time ?? "any"} onValueChange={(time) => set({ time: time === "any" ? undefined : (time as Wild["time"]) })}>
          <SelectTrigger className="h-7 min-w-0 flex-1 text-xs" aria-label="When it appears">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            <SelectItem value="morning">Mornings only</SelectItem>
            <SelectItem value="day">Daytime only</SelectItem>
            <SelectItem value="night">Nights only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {creature.method === "fish" ? (
        <div className="flex items-center gap-1.5">
          <Select value={creature.rod ?? "old"} onValueChange={(rod) => set({ rod: rod === "old" ? undefined : (rod as Wild["rod"]) })}>
            <SelectTrigger className="h-7 min-w-0 flex-1 text-xs" aria-label="Rod needed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="old">Any rod</SelectItem>
              <SelectItem value="good">Good Rod or better</SelectItem>
              <SelectItem value="super">Super Rod</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}

/** Where every wild Pokémon of the town lives: open the list, filter by Pokémon, jump to a place */
export function wildIndex() {
  return openDialog<void>((close) => <WildIndex close={close} />);
}

function WildIndex({ close }: { close: () => void }) {
  const editor = useEditor();
  const [only, setOnly] = useState(0);
  const all = habitats(editor.world);
  const ids = [...new Set(all.map(({ wild }) => wild.species))].filter((id) => !only || id === only).sort((a, b) => a - b);
  const methods = { walk: "walking", surf: "surfing", fish: "fishing" };
  const times = { morning: "mornings", day: "daytime", night: "nights" };
  const jump = ({ map, zone }: Habitat) => {
    close();
    session.openArea(map === editor.world ? "" : map.id);
    session.editor.select("zone");
    session.editor.setZone(zone + 1);
    const at = map.zone.indexOf(zone + 1);
    if (at >= 0) session.map.center((at % map.width) + 0.5, Math.floor(at / map.width) + 0.5);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Where Pokémon live</DialogTitle>
          <DialogDescription>Every wild Pokémon of the town and the maps it lives on. Click a place to go paint there.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <SpeciesInput value={only} onChange={setOnly} />
          {only ? (
            <Button variant="ghost" size="sm" onClick={() => setOnly(0)}>
              Show all
            </Button>
          ) : null}
        </div>
        {ids.length ? null : <Hint>{only ? "This Pokémon doesn't live anywhere in the town yet." : "No wild Pokémon yet: paint an encounter zone."}</Hint>}
        <ul className="grid gap-2">
          {ids.map((id) => (
            <li key={id} className="grid gap-1 rounded-lg border border-border bg-card p-2">
              <span className="flex items-center gap-2">
                <CanvasView className="h-[30px] w-[34px] shrink-0 overflow-hidden" make={() => portrait(id, 1)} deps={[id]} />
                <b className="text-sm">{species(id)?.name ?? `#${id}`}</b>
              </span>
              <span className="flex flex-wrap gap-1">
                {all
                  .filter(({ wild }) => wild.species === id)
                  .map((place, i) => (
                    <button
                      key={i}
                      onClick={() => jump(place)}
                      className="rounded-md border border-border px-2 py-0.5 text-left text-[11px] text-muted-foreground hover:border-ring hover:text-foreground"
                    >
                      {place.map === editor.world ? "Outside" : place.map.name} · {methods[methodOf(place.wild)]} · Lv {place.wild.min}–{place.wild.max}
                      {place.wild.time ? ` · ${times[place.wild.time]}` : ""}
                    </button>
                  ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Encounter zones: pick a zone, paint where it applies, and choose its Pokémon */
export function ZonesPanel() {
  const editor = useEditor();
  const zones = editor.city.zones;
  return (
    <div className="grid grid-cols-1 gap-2">
      <Hint>
        Pick a zone, then paint where it applies. Visitors walking there may meet its walking Pokémon. Paint it on water too for Pokémon met surfing, and hooked
        with a rod. Mornings and nights go by the map&apos;s time of day (set it in Map settings).
      </Hint>
      {zones.map((zone, z) => (
        <div
          key={z}
          onClick={(event) => !(event.target as HTMLElement).closest("input, button, [role=slider]") && editor.setZone(z + 1)}
          className={cn("grid min-w-0 gap-2 rounded-lg border bg-card p-2.5", editor.zone === z + 1 ? "border-select" : "border-border")}
        >
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: `#${zone.color.toString(16).padStart(6, "0")}` }} />
            <TextInput aria-label="Zone name" value={zone.name} onCommit={(name) => editor.mutate(() => (zone.name = name))} className="h-8" />
            <Tip label="Delete zone">
              <button
                aria-label="Delete zone"
                onClick={() => editor.deleteZone(z)}
                className="grid size-7 place-items-center rounded text-subtle-fg hover:text-destructive"
              >
                <X size={14} />
              </button>
            </Tip>
          </div>
          <Rate zone={zone} onCommit={(rate) => editor.mutate(() => (zone.rate = rate))} />
          {methods.map(({ key, label, hint }) => {
            const list = zone.creatures.filter((wild) => methodOf(wild) === key);
            return (
              <div key={key} className="grid min-w-0 gap-1.5">
                <p className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-subtle-fg" title={hint}>
                  {label}
                  <span className="font-normal normal-case tracking-normal">{list.length || ""}</span>
                </p>
                {list.map((creature) => (
                  <Creature key={zone.creatures.indexOf(creature)} zone={zone} creature={creature} />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 justify-start text-muted-foreground"
                  onClick={() =>
                    editor.mutate(() =>
                      zone.creatures.push({
                        species: key === "walk" ? 1 + Math.floor(Math.random() * assets.pokedex.length) : key === "surf" ? 72 : 129,
                        min: key === "walk" ? 3 : 5,
                        max: key === "walk" ? 6 : 10,
                        ...(key === "walk" ? {} : { method: key }),
                      }),
                    )
                  }
                >
                  <Plus />
                  Add Pokémon
                </Button>
              </div>
            );
          })}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => editor.addZone()}>
        <Plus />
        New zone
      </Button>
      <Button variant="ghost" size="sm" onClick={() => wildIndex()}>
        <MagnifyingGlass />
        Where Pokémon live
      </Button>
    </div>
  );
}
