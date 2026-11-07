"use client";

import { openDialog } from "@/components/editor/dialogs";
import { Hint } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type MapKind, newSeed } from "@/game/generator";
import { session } from "@/game/session";
import { ui } from "@/game/ui-bridge";
import { DiceFive, MapTrifold, Path, Sparkle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

/** Open the map generator: a town or route laid out from a seed, previewed before it's made */
export function generateMap(kind: MapKind = "town") {
  return openDialog<void>((close) => <GenerateMap close={close} start={kind} />);
}

function GenerateMap({ close, start }: { close: () => void; start: MapKind }) {
  const [kind, setKind] = useState<MapKind>(start);
  const [seed, setSeed] = useState(newSeed);
  const [busy, setBusy] = useState(false);

  //The same seed always makes the same map, so the preview is what gets made
  const preview = useMemo(() => {
    const made = session.editor.previewOutdoor(kind, seed.trim() || "0");
    if (!made) {
      return null;
    }
    const k = Math.min(1, 560 / (made.map.width * 16), 360 / (made.map.height * 16));
    return { ...made, picture: session.map.picture(made.map, k).toDataURL() };
  }, [kind, seed]);

  const where = preview ? { up: "north", down: "south", left: "west", right: "east" }[preview.side] : "";
  const from = preview ? (preview.beside === session.city ? "the outside map" : preview.beside.name) : "";
  const count = (role: string) => preview?.map.npcs.filter((npc) => npc.role === role && !npc.hidden && !npc.grow).length ?? 0;

  const create = async () => {
    setBusy(true);
    try {
      const made = await session.generateOutdoor(kind, seed.trim() || "0");
      if (!made) {
        return ui.toast("There's no free space next to this map. Move maps apart in the region map first.", "error");
      }
      close();
      ui.toast(`${made.map.name} is ${where} of ${from}. Walk off that edge to go there.`, "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate a map</DialogTitle>
          <DialogDescription>
            A town or route laid out like Hoenn&apos;s, joined to the edge of the map you have open. Re-roll until you like it, then edit it like any other map.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={kind === "town" ? "default" : "outline"} size="sm" onClick={() => setKind("town")}>
            <MapTrifold />
            Town
          </Button>
          <Button variant={kind === "route" ? "default" : "outline"} size="sm" onClick={() => setKind("route")}>
            <Path />
            Route
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="generator-seed" className="text-xs text-subtle-fg">
              Seed
            </label>
            <Input id="generator-seed" value={seed} onChange={(event) => setSeed(event.target.value)} className="h-8 w-28 font-mono text-xs" maxLength={24} />
            <Button variant="outline" size="sm" onClick={() => setSeed(newSeed())}>
              <DiceFive />
              Re-roll
            </Button>
          </div>
        </div>
        {preview ? (
          <>
            <div className="grid place-items-center overflow-hidden rounded-lg border border-border bg-[#0a0a0a] p-2">
              <img src={preview.picture} alt={`Preview of ${preview.map.name}`} className="max-h-[360px] max-w-full [image-rendering:pixelated]" />
            </div>
            <p className="text-xs text-subtle-fg">
              <span className="font-medium text-foreground">{preview.map.name}</span> · {preview.map.width}×{preview.map.height} · {where} of {from} ·{" "}
              {kind === "town"
                ? `${preview.made.buildings.length} buildings (Pokémon Center, Poké Mart, houses), wild grass`
                : `${count("trainer")} trainers, ${count("item")} items, a hidden item and a berry tree, wild grass and ledges`}
            </p>
          </>
        ) : (
          <Hint>There&apos;s no free space next to this map. Move maps apart in the region map first.</Hint>
        )}
        <Hint>
          The same seed always makes the same map. Town buildings get Emerald&apos;s rooms with their doors linked both ways, and the wild Pokémon go in a new
          encounter zone you can edit.
        </Hint>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" disabled={!preview || busy} onClick={create}>
            <Sparkle />
            {busy ? "Making it…" : `Make this ${kind}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
