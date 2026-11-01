"use client";

import { useEditor } from "@/components/editor/hooks";
import { SpeciesInput } from "@/components/editor/pokemon-picker";
import { Hint, NumberInput, TextInput, Tip, useDraft } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { assets } from "@/game/assets";
import type { Zone } from "@/game/data";
import { cn } from "@/lib/utils";
import { Plus, X } from "@phosphor-icons/react";

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

/** Encounter zones: pick a zone, paint where it applies, and choose its Pokémon */
export function ZonesPanel() {
  const editor = useEditor();
  const zones = editor.city.zones;
  return (
    <div className="grid grid-cols-1 gap-2">
      <Hint>Pick a zone, then paint where it applies. Visitors walking there may meet these Pokémon.</Hint>
      {zones.map((zone, z) => (
        <div
          key={z}
          onClick={(event) => !(event.target as HTMLElement).closest("input, button, [role=slider]") && editor.setZone(z + 1)}
          className={cn("grid gap-2 rounded-lg border bg-card p-2.5", editor.zone === z + 1 ? "border-select" : "border-border")}
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
          {zone.creatures.map((creature, c) => (
            <div key={c} className="flex items-center gap-1.5">
              <SpeciesInput value={creature.species} onChange={(id) => editor.mutate(() => (creature.species = id))} />
              <NumberInput aria-label="Lowest level" value={creature.min} onCommit={(value) => editor.mutate(() => (creature.min = value))} className="w-12" />
              <span className="text-subtle-fg">–</span>
              <NumberInput aria-label="Highest level" value={creature.max} onCommit={(value) => editor.mutate(() => (creature.max = value))} className="w-12" />
              <button
                aria-label="Remove Pokémon"
                title="Remove Pokémon"
                onClick={() => editor.mutate(() => zone.creatures.splice(c, 1))}
                className="grid size-7 shrink-0 place-items-center rounded text-subtle-fg hover:text-destructive"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground"
            onClick={() => editor.mutate(() => zone.creatures.push({ species: 1 + Math.floor(Math.random() * assets.pokedex.length), min: 3, max: 6 }))}
          >
            <Plus />
            Add Pokémon
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => editor.addZone()}>
        <Plus />
        New zone
      </Button>
    </div>
  );
}
