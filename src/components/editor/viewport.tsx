"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { Tip } from "@/components/editor/widgets";
import { size } from "@/game/assets";
import { storage } from "@/game/data";
import { session as engine } from "@/game/session";
import { cn } from "@/lib/utils";
import { Crosshair, GridFour, MapPin, MapTrifold, Minus, Play, Plus, Sidebar as SidebarIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

/** Floating map controls: zoom, center, grid, minimap and side panel */
export function MapControls({ minimap, onMinimap, onPanel }: { minimap: boolean; onMinimap: () => void; onPanel: () => void }) {
  const session = useSession();
  const editor = useEditor();
  const [zoom, setZoom] = useState(300);
  //The map lives outside React: hook into it through the engine, and redo it when the map changes
  useEffect(() => {
    if (engine.map) {
      engine.map.onzoom = (scale: number) => setZoom(Math.round(scale * 100));
    }
  }, [session.map]);
  const button = "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";
  const edit = session.mode === "edit";
  return (
    <div className="absolute bottom-3 right-3 z-20 flex gap-2">
      <div className="flex items-center rounded-lg border border-border bg-card/95 p-0.5 shadow-lg backdrop-blur">
        <Tip label="Zoom out" shortcut="−" description="Pinch or Ctrl+scroll also zooms"><button aria-label="Zoom out" className={button} onClick={() => session.map.zoom(0.8)}><Minus size={15} /></button></Tip>
        <Tip label="Reset zoom" description="Back to 300%"><button className="w-14 rounded-md py-1 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => session.map.scale(3)}>{zoom}%</button></Tip>
        <Tip label="Zoom in" shortcut="+" description="Pinch or Ctrl+scroll also zooms"><button aria-label="Zoom in" className={button} onClick={() => session.map.zoom(1.25)}><Plus size={15} /></button></Tip>
      </div>
      <div className="flex items-center rounded-lg border border-border bg-card/95 p-0.5 shadow-lg backdrop-blur">
        <Tip label="Center" shortcut="0" description="Fit the whole map on screen, or snap back to your trainer in Play"><button aria-label="Center" className={button} onClick={() => edit ? session.map.fit() : session.map.scale(3)}><Crosshair size={15} /></button></Tip>
        {edit ? <Tip label="Grid" shortcut="G" description="Show or hide the tile grid"><button aria-label="Grid" aria-pressed={editor?.grid} className={cn(button, editor?.grid && "text-foreground")} onClick={() => editor?.toggleGrid()}><GridFour size={15} /></button></Tip> : null}
        <Tip label="Minimap" description="Overview of the whole map, click it to jump around"><button aria-label="Minimap" aria-pressed={minimap} className={cn(button, minimap && "text-foreground")} onClick={onMinimap}><MapTrifold size={15} /></button></Tip>
        {edit ? <Tip label="Side panel" description="Show or hide the layers and tiles panel"><button aria-label="Side panel" className={button} onClick={onPanel}><SidebarIcon size={15} /></button></Tip> : null}
      </div>
    </div>
  );
}

/** Right-click menu on a map tile (Build only) */
export function MapMenu() {
  const session = useSession();
  const menu = session.menu;
  const ref = useRef<HTMLDivElement>(null);
  //Close on a click elsewhere, Escape, or when the map moves
  useEffect(() => {
    if (!menu) {
      return;
    }
    const outside = (event: Event) => !ref.current?.contains(event.target as Node) && engine.closeMenu();
    const escape = (event: KeyboardEvent) => event.key === "Escape" && engine.closeMenu();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("wheel", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("wheel", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  if ((!menu) || (session.mode !== "edit")) {
    return null;
  }
  const { tile } = menu;
  const item = "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent";
  return (
    <div ref={ref} role="menu" style={{ left: Math.min(menu.left, window.innerWidth - 216), top: Math.min(menu.top, window.innerHeight - 140) }} className="fixed z-50 w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
      <p className="px-2 pb-1 pt-0.5 font-mono text-[11px] text-subtle-fg">Tile {tile.x}, {tile.y}</p>
      <button role="menuitem" className={item} onClick={() => void engine.playFrom(tile)}>
        <Play size={15} weight="fill" />Play from here<kbd className="ml-auto font-mono text-[11px] text-subtle-fg">P</kbd>
      </button>
      <button role="menuitem" className={item} onClick={() => (engine.editor.mutate(() => engine.area.spawn = { ...tile }), engine.closeMenu())}>
        <MapPin size={15} />Visitors arrive here
      </button>
    </div>
  );
}

/** Minimap: whole map overview with the visible area, click or drag to move around */
export function Minimap() {
  const session = useSession();
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const scale = useRef(1);
  useEffect(() => {
    const map = engine.map;
    if (!map) {
      return;
    }
    let timer = 0;
    const draw = () => {
      timer = 0;
      if ((!engine.area) || (!map.city) || (!canvas.current)) {
        return;
      }
      const { width, height } = map.city;
      scale.current = Math.min(180 / (width * size), 140 / (height * size));
      const image = map.snapshot(scale.current);
      canvas.current.width = image.width;
      canvas.current.height = image.height;
      canvas.current.getContext("2d")!.drawImage(image, 0, 0);
    };
    //Redraw shortly after tiles change (painting, room edits, loading a map)
    map.ontiles = () => (!timer) && (timer = setTimeout(draw, 400) as unknown as number);
    draw();
    const tick = () => {
      if (!frame.current) {
        return;
      }
      const { x, y, w, h } = map.view;
      const unit = size * scale.current;
      Object.assign(frame.current.style, { left: `${x * unit}px`, top: `${y * unit}px`, width: `${w * unit}px`, height: `${h * unit}px` });
    };
    map.app.ticker.add(tick);
    return () => (map.app.ticker.remove(tick), map.ontiles = null, clearTimeout(timer));
  }, [session.map, session.area]);
  const jump = (event: React.PointerEvent) => {
    if (session.mode === "play") {
      return;
    }
    const rect = canvas.current!.getBoundingClientRect();
    session.map.center((event.clientX - rect.left) / (size * scale.current), (event.clientY - rect.top) / (size * scale.current));
  };
  return (
    <div
      title="Click or drag to move around"
      className="absolute right-3 top-3 z-20 cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      onPointerDown={(event) => (event.currentTarget.setPointerCapture(event.pointerId), jump(event))}
      onPointerMove={(event) => event.buttons && jump(event)}
    >
      <canvas ref={canvas} className="block [image-rendering:pixelated]" />
      <div ref={frame} className="pointer-events-none absolute border border-white/90" />
    </div>
  );
}

/** Bottom status bar: map, hovered tile, zoom and save status */
export function StatusBar() {
  const session = useSession();
  const [tile, setTile] = useState<null | { x: number; y: number }>(null);
  useEffect(() => session.editor?.oncoords(setTile), [session.editor]);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-card px-3 text-[11px] text-subtle-fg">
      <span className="text-muted-foreground">{session.area && session.area !== session.city ? session.area.name : "Outside"}</span>
      <span className="w-14 font-mono">{tile ? `${tile.x}, ${tile.y}` : ""}</span>
      <span className="truncate">{session.saved}</span>
      <span className="ml-auto hidden truncate lg:inline">
        {session.mode === "play"
          ? "WASD or arrows to walk · Shift runs · Space talks · Build takes you back where you were"
          : "Right-click a tile or press P to play from there · Right-drag or two-finger swipe to pan · Ctrl+scroll zooms · 0 centers · G grid"}
      </span>
    </footer>
  );
}

/** Remember a boolean preference */
export function usePreference(key: string, initial: boolean) {
  const [value, setValue] = useState(() => storage.get(key, initial));
  return [value, (next: boolean) => (storage.set(key, next), setValue(next))] as const;
}
