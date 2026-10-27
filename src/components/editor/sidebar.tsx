"use client";

import { DoorsPanel } from "@/components/editor/doors-panel";
import { useEditor } from "@/components/editor/hooks";
import { LayersPane, MapsPane } from "@/components/editor/panes";
import { PeoplePanel } from "@/components/editor/people-panel";
import { StoryPanel } from "@/components/editor/story-panel";
import { AutoCollision, TilesPanel } from "@/components/editor/tiles-panel";
import { Hint, Pane } from "@/components/editor/widgets";
import { ZonesPanel } from "@/components/editor/zones-panel";
import { storage } from "@/game/data";
import { targets } from "@/game/editor/constants";
import { ClipboardText, Copy, Scissors, SelectionPlus, Stamp, Trash } from "@phosphor-icons/react";
import { useState } from "react";

const mod = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘" : "Ctrl+";

/** Select tool: copy, cut, paste, delete, or turn the selection into a brush */
function SelectionPanel() {
  const editor = useEditor();
  const { area, clip, pasting } = editor;
  const actions = [
    { icon: Copy, label: "Copy", key: `${mod}C`, run: () => editor.copy(), disabled: !area },
    { icon: Scissors, label: "Cut", key: `${mod}X`, run: () => editor.cut(), disabled: !area },
    { icon: ClipboardText, label: "Paste", key: `${mod}V`, run: () => editor.paste(), disabled: !clip },
    { icon: Trash, label: "Delete", key: "Del", run: () => editor.clear(), disabled: !area },
    { icon: Stamp, label: "Use as brush", key: "", run: () => editor.capture(), disabled: !area },
  ];
  return (
    <div className="grid grid-cols-1 gap-2">
      <Hint>{pasting ? "Click on the map to paste. Press Esc to stop pasting." : "Drag on the map to select an area. Copying takes every layer, including collision and encounters."}</Hint>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
        <SelectionPlus size={22} className="text-muted-foreground" />
        <div className="min-w-0">
          <b className="block text-sm">{area ? `${area.w}×${area.h} tiles selected` : pasting && clip ? `Pasting ${clip.w}×${clip.h} tiles` : "Nothing selected"}</b>
          <small className="text-xs text-muted-foreground">{area ? `from tile ${area.x}, ${area.y}` : clip ? `Clipboard: ${clip.w}×${clip.h} tiles` : "Clipboard is empty"}</small>
        </div>
      </div>
      <div className="grid gap-0.5">
        {actions.map(({ icon: Icon, label, key, run, disabled }) => (
          <button key={label} disabled={disabled} onClick={run} className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
            <Icon size={15} /><span className="flex-1 text-left">{label}</span>{key ? <kbd className="font-mono text-[10px] text-subtle-fg">{key}</kbd> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Side panel: maps, layers, and the options of the current layer */
export function Sidebar({ onImportTileset, onSprite }: { onImportTileset: () => void; onSprite: (kind: "person" | "pokemon") => Promise<string | undefined> }) {
  const editor = useEditor();
  const [width, setWidth] = useState(() => storage.get("sidebar-width", 320));
  if (!editor) {
    return null;
  }
  const current = targets.find(({ key }) => key === editor.target)!;
  const context = () => {
    switch (editor.target) {
      case "ground":
      case "decor":
      case "above":
        return <TilesPanel onImport={onImportTileset} />;
      case "solid":
        return <div className="grid grid-cols-1 gap-2"><Hint>Paint red tiles where visitors can&apos;t walk, like water, walls and trees. Objects painted on the Objects layer block automatically.</Hint><AutoCollision /></div>;
      case "zone":
        return <ZonesPanel />;
      case "story":
        return <StoryPanel />;
      case "door":
        return <DoorsPanel />;
      case "npc":
        return <PeoplePanel onSprite={onSprite} />;
      case "spawn":
        return <Hint>Visitors start at tile {editor.city.spawn.x}, {editor.city.spawn.y}. Click the map to move the spawn point. Map size, music and tilesets are in City settings.</Hint>;
    }
  };
  return (
    <aside className="relative flex shrink-0 flex-col border-r border-border bg-background" style={{ width }}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <MapsPane />
        <LayersPane />
        {editor.tool === "select"
          ? <Pane title="Selection" hint="copy, cut and paste"><SelectionPanel /></Pane>
          : <Pane title={current.label} hint={current.hint}>{context()}</Pane>}
      </div>
      <div
        title="Drag to resize"
        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-ring/30"
        onPointerDown={(event) => {
          event.preventDefault();
          const handle = event.currentTarget;
          handle.setPointerCapture(event.pointerId);
          const left = handle.parentElement!.getBoundingClientRect().left;
          const clamp = (value: number) => Math.max(260, Math.min(600, value));
          const move = (event: PointerEvent) => setWidth(clamp(event.clientX - left));
          const up = (event: PointerEvent) => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            storage.set("sidebar-width", clamp(event.clientX - left));
          };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
        }}
      />
    </aside>
  );
}
