"use client";

import { openDialog } from "@/components/editor/dialogs";
import { useEditor, useSession } from "@/components/editor/hooks";
import { Hint } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { size } from "@/game/assets";
import type { City } from "@/game/data";
import { collides, edge, outdoors, type Placed, walkable } from "@/game/region";
import { session } from "@/game/session";
import { ui } from "@/game/ui-bridge";
import { cn } from "@/lib/utils";
import { House, Path, Plus } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";

/** Open the region map: the outside map, routes and other towns, joined where they touch */
export function regionMap() {
  return openDialog<void>((close) => <RegionMap close={close} />);
}

/** Make a route or town next to the open outdoor map, open it, and say how to get there */
export function addOutdoor(kind: "route" | "town") {
  const made = session.editor.newOutdoor(kind);
  if (!made) {
    return ui.toast("There's no free space next to this map. Move maps apart in the region map first.", "error");
  }
  const { map, side, beside } = made;
  const where = { up: "north", down: "south", left: "west", right: "east" }[side];
  const from = beside === session.city ? "the outside map" : beside.name;
  session.openArea(map.id);
  ui.toast(`${map.name} is ${where} of ${from}. Walk off that edge to go there: open a gap in any trees or walls along it.`, "success");
}

/** Tiles of `a` and `b` on their shared edge that can be walked across */
function open(a: Placed, b: Placed) {
  const shared = edge(a, b);
  return shared ? shared.tiles.some(({ x, y }) => (walkable(a.map, x, y)) && (walkable(b.map, x + a.x - b.x + shared.dx, y + a.y - b.y + shared.dy))) : false;
}

/** Snap a position so the map touches a neighbor's edge when dropped close to it */
function magnet(placed: Placed[], map: City, x: number, y: number) {
  const reach = 3;
  for (const other of placed) {
    if (other.map === map) {
      continue;
    }
    const [ow, oh] = [other.map.width, other.map.height];
    const rows = (y < other.y + oh) && (other.y < y + map.height);
    const columns = (x < other.x + ow) && (other.x < x + map.width);
    if ((rows) && (Math.abs(x - (other.x + ow)) <= reach)) {
      x = other.x + ow;
    } else if ((rows) && (Math.abs(x + map.width - other.x) <= reach)) {
      x = other.x - map.width;
    }
    if ((columns) && (Math.abs(y - (other.y + oh)) <= reach)) {
      y = other.y + oh;
    } else if ((columns) && (Math.abs(y + map.height - other.y) <= reach)) {
      y = other.y - map.height;
    }
  }
  return { x, y };
}

function RegionMap({ close }: { close: () => void }) {
  useSession();
  const editor = useEditor();
  const world = session.city;
  const placed = outdoors(world);
  const [drag, setDrag] = useState<null | { id: string; x: number; y: number }>(null);
  const start = useRef<null | { id: string; px: number; py: number; x: number; y: number; moved: boolean }>(null);

  //Fit the whole region with some room around it
  const pad = 12;
  const minX = Math.min(...placed.map(({ x }) => x)) - pad, minY = Math.min(...placed.map(({ y }) => y)) - pad;
  const maxX = Math.max(...placed.map(({ x, map }) => x + map.width)) + pad, maxY = Math.max(...placed.map(({ y, map }) => y + map.height)) + pad;
  const scale = Math.max(2, Math.min(10, 860 / (maxX - minX), 480 / (maxY - minY)));
  const key = placed.map(({ map }) => `${map.id}:${map.width}x${map.height}`).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pictures = useMemo(() => new Map(placed.map(({ map }) => [map, session.map.picture(map, Math.min(1, scale / size)).toDataURL()])), [key, scale]);

  const at = (item: Placed) => drag?.id === item.map.id ? { ...item, x: drag.x, y: drag.y } : item;
  const shown = placed.map(at);
  const blocked = drag ? collides(world, placed.find(({ map }) => map.id === drag.id)!.map, drag.x, drag.y) : false;

  const down = (event: React.PointerEvent, item: Placed) => {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    //The outside map stays in place (id "": a click opens it, dragging does nothing)
    start.current = { id: item.map === world ? "" : item.map.id, px: event.clientX, py: event.clientY, x: item.x, y: item.y, moved: false };
  };
  const move = (event: React.PointerEvent) => {
    const from = start.current;
    if ((!from) || (from.id === "")) {
      return;
    }
    const [dx, dy] = [Math.round((event.clientX - from.px) / scale), Math.round((event.clientY - from.py) / scale)];
    if ((dx) || (dy)) {
      from.moved = true;
    }
    const map = placed.find((item) => item.map.id === from.id)!.map;
    setDrag({ id: from.id, ...magnet(placed, map, from.x + dx, from.y + dy) });
  };
  const up = (item: Placed) => {
    const from = start.current;
    start.current = null;
    if (!from?.moved) {
      setDrag(null);
      close();
      return session.openArea(item.map === world ? "" : item.map.id);
    }
    if ((drag) && (!editor.moveMap(drag.id, drag.x, drag.y))) {
      ui.toast("Maps can't overlap", "error");
    }
    setDrag(null);
  };

  //Edges between maps that touch: amber when the player can walk across, red when it's closed everywhere
  const edges = [] as { key: string; left: number; top: number; width: number; height: number; open: boolean }[];
  shown.forEach((a, i) => shown.slice(i + 1).forEach((b) => {
    const shared = edge(a, b);
    if (!shared) {
      return;
    }
    const xs = shared.tiles.map(({ x }) => a.x + x + (shared.dx > 0 ? 1 : 0)), ys = shared.tiles.map(({ y }) => a.y + y + (shared.dy > 0 ? 1 : 0));
    const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
    const [w, h] = shared.dx ? [0, shared.tiles.length] : [shared.tiles.length, 0];
    edges.push({ key: `${a.map.id}-${b.map.id}`, left: (x0 - minX) * scale - 2, top: (y0 - minY) * scale - 2, width: w * scale + 4, height: h * scale + 4, open: open(a, b) });
  }));

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Region map</DialogTitle>
          <DialogDescription>The outside map, routes and other towns. Drag a map next to another to join them: the player walks from one to the other across the edge they share. Click a map to open it.</DialogDescription>
        </DialogHeader>
        <div className="overflow-auto rounded-lg border border-border bg-[#0a0a0a]">
          <div className="relative" style={{ width: (maxX - minX) * scale, height: (maxY - minY) * scale, backgroundImage: "linear-gradient(to right, rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: `${scale * 8}px ${scale * 8}px` }}>
            {shown.map((item) => {
              const root = item.map === world;
              const current = item.map === session.area;
              const dragging = drag?.id === item.map.id;
              return (
                <div
                  key={item.map.id || "outside"}
                  role="button"
                  tabIndex={0}
                  title={root ? "The outside map stays in place: move the others around it" : "Drag to move, click to open"}
                  onPointerDown={(event) => down(event, item)}
                  onPointerMove={move}
                  onPointerUp={() => up(placed.find(({ map }) => map === item.map)!)}
                  onKeyDown={(event) => event.key === "Enter" && (close(), session.openArea(root ? "" : item.map.id))}
                  className={cn("absolute select-none overflow-hidden rounded-sm border-2 bg-cover bg-no-repeat [image-rendering:pixelated]", root ? "cursor-pointer" : "cursor-grab active:cursor-grabbing", current ? "border-select" : "border-white/30 hover:border-white/70", dragging && (blocked ? "border-destructive opacity-70" : "z-10 opacity-90 shadow-xl"))}
                  style={{ left: (item.x - minX) * scale, top: (item.y - minY) * scale, width: item.map.width * scale, height: item.map.height * scale, backgroundImage: `url(${pictures.get(item.map)})`, backgroundSize: "100% 100%" }}
                >
                  <span className="pointer-events-none absolute left-1 top-1 inline-flex max-w-[calc(100%-8px)] items-center gap-1 truncate rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">{root ? <House size={11} /> : <Path size={11} />}{root ? `${world.name} (outside)` : item.map.name}</span>
                </div>
              );
            })}
            {edges.map(({ key, open, ...box }) => <span key={key} aria-hidden className={cn("pointer-events-none absolute z-20 rounded-full", open ? "bg-select" : "bg-destructive")} style={box} />)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle-fg">
          <span className="inline-flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-select" />The player can walk across</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-destructive" />Closed: trees or walls along the whole edge</span>
        </div>
        <Hint>Maps snap together when you drop them close to each other. To walk across, both maps need open tiles facing each other on their shared edge.</Hint>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => (close(), addOutdoor("route"))}><Plus />New route</Button>
          <Button variant="outline" size="sm" onClick={() => (close(), addOutdoor("town"))}><Plus />New town</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
