"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { targetIcons } from "@/components/editor/icons";
import { Pane, TextInput, Tip } from "@/components/editor/widgets";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Target, targets, templates } from "@/game/editor/constants";
import { ui } from "@/game/ui-bridge";
import { cn } from "@/lib/utils";
import { DoorOpen, Eye, EyeSlash, Lock, LockOpen, MapTrifold, Plus, Trash } from "@phosphor-icons/react";

/** Maps of the city: outside and interiors */
export function MapsPane() {
  const session = useSession();
  const editor = useEditor();
  const world = session.city;
  const row = (id: string, name: string) => {
    const active = editor.mapId === id;
    const Icon = id ? DoorOpen : MapTrifold;
    return (
      <div key={id || "outside"} role="button" tabIndex={0} title={id ? "Edit this interior" : "Edit the outside map"} onClick={() => !active && session.openArea(id)} onKeyDown={(event) => event.key === "Enter" && session.openArea(id)} className={cn("group flex h-8 items-center gap-2 rounded-md px-2 pointer-coarse:h-10 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", active && "bg-muted text-foreground")}>
        <Icon size={15} className="shrink-0" />
        {active && id
          ? <TextInput aria-label="Interior name" value={name} maxLength={30} onCommit={(value) => editor.renameInterior(value)} onClick={(event) => event.stopPropagation()} className="h-6 border-transparent bg-transparent px-1 text-sm shadow-none focus-visible:border-input" />
          : <span className="flex-1 truncate">{name}</span>}
        {id
          ? (
            <Tip label="Delete interior">
              <button aria-label="Delete interior" onClick={async (event) => {
                event.stopPropagation();
                if (await ui.confirm(`Delete ${name}?`, { text: "Doors leading to this interior will be removed too.", action: "Delete", danger: true })) {
                  editor.removeInterior(id);
                }
              }} className="grid size-6 place-items-center rounded text-subtle-fg opacity-0 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"><Trash size={14} /></button>
            </Tip>
          )
          : null}
      </div>
    );
  };
  return (
    <Pane
      title="Maps"
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button title="Add an interior map" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><Plus size={12} />Interior</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {templates.map(({ key, label }) => <DropdownMenuItem key={key} onSelect={() => session.openArea(editor.newInterior(key).id)}>{label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="grid gap-0.5">
        {row("", "Outside")}
        {world.interiors.map((map) => row(map.id, map.name))}
      </div>
    </Pane>
  );
}

/** Layers: tile layers (drawn top to bottom) and gameplay layers */
export function LayersPane() {
  const editor = useEditor();
  const row = (key: Target) => {
    const index = targets.findIndex((target) => target.key === key);
    const { label, hint } = targets[index];
    const Icon = targetIcons[key];
    const active = editor.target === key;
    const hidden = editor.isHidden(key);
    const locked = editor.isLocked(key);
    const toggle = "grid size-6 place-items-center rounded text-subtle-fg hover:text-foreground";
    return (
      <div key={key} role="button" tabIndex={0} title={hint} onClick={() => editor.select(key)} onKeyDown={(event) => (["Enter", " "].includes(event.key)) && (event.preventDefault(), editor.select(key))} className={cn("group flex h-8 items-center gap-2 rounded-md px-2 pointer-coarse:h-10 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", active && "bg-muted text-foreground", hidden && "opacity-50")}>
        <Icon size={15} className="shrink-0" weight={active ? "fill" : "regular"} />
        <span className="flex-1 truncate">{label}</span>
        <span className={cn("flex items-center opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100", (hidden || locked) && "opacity-100")}>
          {editor.canHide(key) ? <button aria-label={hidden ? "Show layer" : "Hide layer"} title={hidden ? "Show layer" : "Hide layer"} onClick={(event) => (event.stopPropagation(), editor.toggleHidden(key))} className={toggle}>{hidden ? <EyeSlash size={14} /> : <Eye size={14} />}</button> : <span className="size-6" />}
          <button aria-label={locked ? "Unlock layer" : "Lock layer"} title={locked ? "Unlock layer" : "Lock layer"} onClick={(event) => (event.stopPropagation(), editor.toggleLocked(key))} className={toggle}>{locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
        </span>
        <kbd className="w-4 text-center font-mono text-[10px] text-subtle-fg">{index + 1}</kbd>
      </div>
    );
  };
  return (
    <Pane title="Layers" hint="drawn top to bottom">
      <div className="grid gap-0.5">{(["above", "decor", "ground"] as Target[]).map(row)}</div>
      <p className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Gameplay</p>
      <div className="grid gap-0.5">{(["solid", "zone", "story", "door", "npc", "spawn"] as Target[]).map(row)}</div>
    </Pane>
  );
}
