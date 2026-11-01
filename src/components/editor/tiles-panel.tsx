"use client";

import { removeTileset } from "@/components/editor/city-dialogs";
import { useEditor } from "@/components/editor/hooks";
import { CanvasView, Hint, Removable, Tip } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { assets, size } from "@/game/assets";
import { brushes, terrains } from "@/game/brushes";
import { type Layer, storage } from "@/game/data";
import type { Stamp } from "@/game/editor/constants";
import { targets } from "@/game/editor/constants";
import type { EditorEngine } from "@/game/editor/engine";
import { decode, range } from "@/game/tilesets";
import { cn } from "@/lib/utils";
import { MagnifyingGlass, Minus, Plus, Shuffle, Star, Trash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

/** Palette scroll positions per tileset (kept while switching tabs and panels) */
const scrolls = new Map<number, [number, number]>();

/** "Objects block movement automatically" switch */
export function AutoCollision() {
  const editor = useEditor();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Switch checked={editor.auto} onCheckedChange={(value) => editor.setAuto(value)} />
      Objects block movement automatically
    </label>
  );
}

/** Stamp button with a thumbnail */
function StampButton({ editor, stamp, label }: { editor: EditorEngine; stamp: Stamp; label?: string }) {
  const active = JSON.stringify(stamp.tiles) === JSON.stringify(editor.stamp.tiles) && stamp.terrain === editor.stamp.terrain;
  return (
    <button
      title={stamp.name ?? `${stamp.w}×${stamp.h} tiles`}
      onClick={() => editor.use(stamp)}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-md border bg-card p-1.5 transition-colors hover:border-ring",
        active ? "border-select ring-1 ring-select" : "border-border",
      )}
    >
      <CanvasView
        className="h-10 w-full overflow-hidden [&_canvas]:max-h-10 [&_canvas]:max-w-full"
        make={() => editor.stampCanvas(stamp, 2)}
        deps={[JSON.stringify(stamp.tiles), editor.sheet]}
      />
      {label ? <span className="w-full truncate text-center text-[10.5px] text-muted-foreground">{label}</span> : null}
    </button>
  );
}

/** Name a favorite and save it */
function SaveFavorite({ editor }: { editor: EditorEngine }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const saved = editor.favorite;
  const custom = editor.stamp.tiles.some((value) => value >= range);
  if (saved >= 0) {
    return (
      <Tip label="Remove from favorites">
        <button
          aria-label="Remove from favorites"
          onClick={() => editor.removeFavorite(saved)}
          className="grid size-8 place-items-center rounded-md text-select hover:bg-muted"
        >
          <Star size={16} weight="fill" />
        </button>
      </Tip>
    );
  }
  return (
    <Popover open={open} onOpenChange={(next) => (setOpen(next), next && setName(editor.stamp.name ?? ""))}>
      <Tip label={custom ? "Favorites hold Hoenn tiles only" : "Save to favorites"} description={custom ? undefined : "Name it to find it with search"}>
        <PopoverTrigger asChild>
          <button
            aria-label="Save to favorites"
            disabled={custom}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Star size={16} />
          </button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="w-64 p-3">
        <form className="grid gap-2" onSubmit={(event) => (event.preventDefault(), editor.addFavorite(name), setOpen(false))}>
          <Label htmlFor="favorite-name" className="text-xs text-muted-foreground">
            Name this favorite
          </Label>
          <Input
            id="favorite-name"
            autoFocus
            value={name}
            maxLength={32}
            placeholder="Blue roof house"
            onChange={(event) => setName(event.target.value)}
            className="h-8"
          />
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Tile layers panel: current brush, search, favorites, stamps, terrains, recent brushes and the tileset palette */
export function TilesPanel({ onImport }: { onImport: () => void }) {
  const editor = useEditor();
  const { stamp } = editor;
  const [query, setQuery] = useState("");
  const layerLabel = targets.find(({ key }) => key === (stamp.layer ?? editor.target))?.label;
  const group = "mb-1.5 mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-subtle-fg";
  const stamps = brushes.map((brush) => ({ stamp: brush as Stamp, label: brush.name.replace(/ \(.*\)$/, "") }));
  const terrainStamps = terrains.map((terrain) => ({
    stamp: { w: 3, h: 3, tiles: terrain.tiles, name: terrain.name, terrain: terrain.id, layer: "decor", solid: "none" } as Stamp,
    label: terrain.name,
  }));
  const favorites = editor.favorites.map((favorite, index) => ({ stamp: favorite as Stamp, label: favorite.name, index }));
  //Search names of favorites, stamps and terrains
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = words.length
    ? [...favorites, ...stamps, ...terrainStamps].filter(({ stamp }) => words.every((word) => `${stamp.name ?? ""}`.toLowerCase().includes(word)))
    : [];
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
        <CanvasView
          className="size-12 shrink-0 overflow-hidden rounded bg-muted [&_canvas]:max-h-12 [&_canvas]:max-w-12"
          make={() => editor.stampCanvas(stamp, 2)}
          deps={[JSON.stringify(stamp.tiles), stamp.terrain]}
        />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-sm">{stamp.name ?? "Custom selection"}</b>
          <small className="block text-xs text-muted-foreground">
            {stamp.terrain
              ? "Terrain · borders and corners are picked automatically"
              : editor.random
                ? `Random: each cell gets one of ${stamp.tiles.filter(Boolean).length} tiles`
                : `${stamp.w}×${stamp.h} ${stamp.w * stamp.h > 1 ? "tiles" : "tile"} · paints on ${layerLabel}`}
          </small>
        </div>
        <SaveFavorite editor={editor} />
        <Tip
          label="Random mode"
          description={editor.random ? "On: each cell gets a random tile of the brush" : "Paint a random tile of the brush in each cell"}
        >
          <button
            aria-label="Random mode"
            aria-pressed={editor.random}
            onClick={() => editor.setRandom(!editor.random)}
            className={cn(
              "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
              editor.random && "bg-muted text-select",
            )}
          >
            <Shuffle size={16} />
          </button>
        </Tip>
      </div>
      {editor.layer === "decor" ? <AutoCollision /> : null}
      <div className="relative">
        <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle-fg" />
        <Input
          type="search"
          aria-label="Search stamps and favorites"
          value={query}
          placeholder="Search stamps and favorites"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setQuery("")}
          className="h-8 pl-8 text-sm"
        />
      </div>
      {words.length ? (
        <>
          <div className={group}>
            <span>Results</span>
            <span className="font-normal normal-case tracking-normal">{found.length || "none"}</span>
          </div>
          {found.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {found.map(({ stamp, label }, i) => (
                <StampButton key={i} editor={editor} stamp={stamp} label={label} />
              ))}
            </div>
          ) : (
            <Hint>Nothing named like that. Tiles from the tileset below have no names: pick some, then press the star to save them as a named favorite.</Hint>
          )}
        </>
      ) : (
        <>
          {favorites.length ? (
            <>
              <div className={group}>
                <span>Favorites</span>
                <span className="font-normal normal-case tracking-normal">saved in this browser</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {favorites.map(({ stamp, label, index }) => (
                  <Removable key={index} label={`Remove ${label} from favorites`} onRemove={() => editor.removeFavorite(index)}>
                    <StampButton editor={editor} stamp={stamp} label={label} />
                  </Removable>
                ))}
              </div>
            </>
          ) : null}
          <div className={group}>
            <span>Stamps</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {stamps.map(({ stamp, label }) => (
              <StampButton key={label} editor={editor} stamp={stamp} label={label} />
            ))}
          </div>
          <div className={group}>
            <span>Terrains</span>
            <span className="font-normal normal-case tracking-normal">borders draw themselves</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {terrainStamps.map(({ stamp, label }) => (
              <StampButton key={label} editor={editor} stamp={stamp} label={label} />
            ))}
          </div>
          {editor.recent.length ? (
            <>
              <div className={group}>
                <span>Recent</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {editor.recent.slice(0, 8).map((recent, i) => (
                  <StampButton key={i} editor={editor} stamp={recent} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
      <Palette editor={editor} onImport={onImport} />
    </div>
  );
}

/** Full tileset palette: drag across it to pick a group of tiles, Ctrl+scroll or pinch to zoom */
function Palette({ editor, onImport }: { editor: EditorEngine; onImport: () => void }) {
  const sheet = editor.sheet;
  const source = editor.source(sheet)!;
  const scale = editor.paletteScale;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<null | { start: { x: number; y: number }; end: { x: number; y: number } }>(null);
  const [height, setHeight] = useState(() => storage.get("palette-height", 320));
  const rows = source.canvas.height / size;
  //Show the Hoenn tiles of one layer (the others are dimmed, so groups keep their place)
  const [filter, setFilter] = useState<"all" | Layer>(() => storage.get("palette-filter", "all"));
  const filtering = sheet < 0 && filter !== "all";
  const dim = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = dim.current;
    if (!element || !filtering) {
      return;
    }
    element.width = source.canvas.width;
    element.height = source.canvas.height;
    const context = element.getContext("2d")!;
    context.fillStyle = "rgba(10, 10, 10, 0.82)";
    for (let frame = 0; frame < source.columns * rows; frame++) {
      const usual = assets.ground.has(frame) ? "ground" : assets.above.has(frame) ? "above" : "decor";
      if (usual !== filter && !source.empty.has(frame)) {
        context.fillRect((frame % source.columns) * size, Math.floor(frame / source.columns) * size, size, size);
      }
    }
  }, [filtering, filter, source, rows]);

  //Draw the tileset at its native resolution (zooming only changes the displayed size)
  useEffect(() => {
    const element = canvas.current!;
    element.width = source.canvas.width;
    element.height = source.canvas.height;
    element.getContext("2d")!.drawImage(source.canvas, 0, 0);
  }, [source.canvas]);

  //Keep the scroll position of each tileset
  useEffect(() => {
    const element = box.current!;
    const [left, top] = scrolls.get(sheet) ?? [0, 0];
    element.scrollLeft = left;
    element.scrollTop = top;
    const save = () => scrolls.set(sheet, [element.scrollLeft, element.scrollTop]);
    element.addEventListener("scroll", save, { passive: true });
    return () => element.removeEventListener("scroll", save);
  }, [sheet]);

  //Zoom around a point of the palette (keeps that point under the cursor)
  const zoom = (factor: number, snap = true, ax?: number, ay?: number) => {
    const element = box.current!;
    const [x, y] = [ax ?? element.clientWidth / 2, ay ?? element.clientHeight / 2];
    const previous = editor.paletteScale;
    const next = Math.min(4, Math.max(0.5, snap ? Math.round(previous * factor * 4) / 4 : previous * factor));
    if (next === previous) {
      return;
    }
    const [px, py] = [(element.scrollLeft + x) / previous, (element.scrollTop + y) / previous];
    editor.setPaletteScale(next);
    requestAnimationFrame(() => ((element.scrollLeft = px * next - x), (element.scrollTop = py * next - y)));
  };
  useEffect(() => {
    const element = box.current!;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = element.getBoundingClientRect();
        zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.01), false, event.clientX - rect.left, event.clientY - rect.top);
      }
    };
    let gesture = 1;
    const start = (event: Event) => (event.preventDefault(), (gesture = 1));
    const change = (event: Event) => {
      event.preventDefault();
      const { scale, clientX, clientY } = event as unknown as { scale: number; clientX: number; clientY: number };
      const rect = element.getBoundingClientRect();
      zoom(scale / gesture, false, clientX - rect.left, clientY - rect.top);
      gesture = scale;
    };
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("gesturestart", start);
    element.addEventListener("gesturechange", change);
    return () => (
      element.removeEventListener("wheel", wheel),
      element.removeEventListener("gesturestart", start),
      element.removeEventListener("gesturechange", change)
    );
  });

  //Tile under the pointer
  const cell = (event: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const unit = rect.width / source.columns;
    return {
      x: Math.max(0, Math.min(source.columns - 1, Math.floor((event.clientX - rect.left) / unit))),
      y: Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / unit))),
    };
  };
  const pick = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const [x0, y0, w, h] = [Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x) + 1, Math.abs(end.y - start.y) + 1];
    const tiles = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const frame = (y0 + j) * source.columns + x0 + i;
        tiles.push(source.empty.has(frame) ? 0 : source.value(frame));
      }
    }
    if (tiles.some(Boolean)) {
      editor.use({ w, h, tiles });
    }
  };

  //Highlight: the drag in progress, or the current stamp when it is a region of this tileset
  const first = editor.stamp.tiles[0] ? decode(editor.stamp.tiles[0]) : null;
  const region = drag
    ? {
        x: Math.min(drag.start.x, drag.end.x),
        y: Math.min(drag.start.y, drag.end.y),
        w: Math.abs(drag.end.x - drag.start.x) + 1,
        h: Math.abs(drag.end.y - drag.start.y) + 1,
      }
    : first && first.index === sheet && !editor.stamp.terrain
      ? { x: first.frame % source.columns, y: Math.floor(first.frame / source.columns), w: editor.stamp.w, h: editor.stamp.h }
      : null;
  const unit = size * scale;

  return (
    <div className="min-w-0">
      <div className="mb-1.5 mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">
        <span>Tileset</span>
        <span className="flex items-center gap-0.5 normal-case tracking-normal">
          <button
            aria-label="Zoom out tileset"
            title="Zoom out tileset"
            onClick={() => zoom(0.8)}
            className="grid size-6 place-items-center rounded hover:bg-muted hover:text-foreground"
          >
            <Minus size={13} />
          </button>
          <button
            title="Reset tileset zoom"
            onClick={() => zoom(2 / editor.paletteScale)}
            className="w-11 rounded py-0.5 font-mono text-[11px] hover:bg-muted hover:text-foreground"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            aria-label="Zoom in tileset"
            title="Zoom in tileset"
            onClick={() => zoom(1.25)}
            className="grid size-6 place-items-center rounded hover:bg-muted hover:text-foreground"
          >
            <Plus size={13} />
          </button>
        </span>
      </div>
      <div role="tablist" className="mb-2 flex flex-wrap items-center gap-1">
        {[{ index: -1, name: "Hoenn" }, ...editor.sheets()].map(({ index, name }) => (
          <button
            key={index}
            role="tab"
            aria-selected={sheet === index}
            onClick={() => editor.setSheet(index)}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs",
              sheet === index ? "bg-muted text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
        {sheet >= 0 ? (
          <Tip label="Remove this tileset" description="Tiles painted with it are erased">
            <button
              aria-label="Remove this tileset"
              onClick={() => removeTileset(sheet)}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash size={13} />
            </button>
          </Tip>
        ) : null}
        <button
          title="Import your own tileset image"
          onClick={onImport}
          className="flex h-7 items-center gap-1 rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground hover:border-ring hover:text-foreground"
        >
          <Plus size={12} />
          Import
        </button>
      </div>
      {sheet < 0 ? (
        <div className="mb-2 grid grid-cols-4 gap-1 rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Show tiles of a layer">
          {(
            [
              ["all", "All"],
              ["ground", "Ground"],
              ["decor", "Objects"],
              ["above", "Above"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={filter === value}
              onClick={() => (setFilter(value), storage.set("palette-filter", value))}
              className={cn(
                "h-6 rounded text-[11px]",
                filter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <div
          ref={box}
          style={{ height }}
          className="overflow-auto rounded-md border border-border bg-[repeating-conic-gradient(#1c1c1c_0_25%,#171717_0_50%)] bg-[length:16px_16px]"
        >
          <div className="relative w-max">
            <canvas
              ref={canvas}
              className="block cursor-crosshair [image-rendering:pixelated]"
              style={{ width: source.canvas.width * scale, height: source.canvas.height * scale }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const at = cell(event);
                setDrag({ start: at, end: at });
              }}
              onPointerMove={(event) => drag && setDrag({ ...drag, end: cell(event) })}
              onPointerUp={(event) => {
                if (drag) {
                  pick(drag.start, cell(event));
                  setDrag(null);
                }
              }}
            />
            {filtering ? (
              <canvas
                ref={dim}
                className="pointer-events-none absolute inset-0 [image-rendering:pixelated]"
                style={{ width: source.canvas.width * scale, height: source.canvas.height * scale }}
              />
            ) : null}
            {region ? (
              <div
                className="pointer-events-none absolute border-2 border-select bg-select/15"
                style={{ left: region.x * unit, top: region.y * unit, width: region.w * unit, height: region.h * unit }}
              />
            ) : null}
          </div>
        </div>
        <div
          title="Drag to resize the palette"
          className="mx-auto mt-1 h-1.5 w-12 cursor-ns-resize rounded-full bg-border hover:bg-ring"
          onPointerDown={(event) => {
            event.preventDefault();
            const handle = event.currentTarget;
            handle.setPointerCapture(event.pointerId);
            const [start, initial] = [event.clientY, height];
            const move = (event: PointerEvent) => setHeight(Math.max(120, Math.min(1200, initial + event.clientY - start)));
            const up = (event: PointerEvent) => {
              handle.removeEventListener("pointermove", move);
              handle.removeEventListener("pointerup", up);
              storage.set("palette-height", Math.max(120, Math.min(1200, initial + event.clientY - start)));
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", up);
          }}
        />
      </div>
      <Hint className="mt-2">
        Drag across the tileset to pick a group of tiles: it paints on the layer those tiles usually sit on. Pinch or Ctrl+scroll to zoom.
      </Hint>
    </div>
  );
}
