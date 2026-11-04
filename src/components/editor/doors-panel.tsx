"use client";

import { useEditor, useSession } from "@/components/editor/hooks";
import { templates } from "@/game/editor/constants";
import { Field, Hint } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DoorOpen, Trash } from "@phosphor-icons/react";

/** Doors: where each door of this map leads */
export function DoorsPanel() {
  const session = useSession();
  const editor = useEditor();
  const doors = editor.city.doors;
  const door = doors[editor.door];
  if (!door) {
    return (
      <div className="grid grid-cols-1 gap-2">
        <Hint>
          {editor.mapId
            ? "Click a tile to add a door. Doors inside an interior lead back outside."
            : "Click a tile, like the entrance of a house, to add a door. Then pick which interior it leads to."}
        </Hint>
        <div className="grid gap-0.5">
          {doors.map((door, i) => (
            <button
              key={i}
              onClick={() => editor.selectDoor(i)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                door.to === "?" && "text-destructive",
              )}
            >
              <DoorOpen size={15} />
              {door.x}, {door.y} → {editor.mapName(door.to)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const options = [
    ...(door.to === "?" ? [{ value: "?", label: "Choose a destination…" }] : []),
    ...(editor.mapId ? [{ value: "outside", label: "Outside" }] : []),
    ...editor.world.interiors.filter((map) => map !== editor.city).map((map) => ({ value: map.id, label: map.name })),
    ...templates.map(({ key, label }) => ({ value: `new:${key}`, label: `+ New ${label}` })),
  ];
  //A new interior is made first (Emerald rooms bring their tilesets), then the door leads there
  const lead = async (value: string) => {
    const to = value.startsWith("new:") ? (await session.newInterior(value.slice(4))).id : value === "outside" ? "" : value;
    editor.setDoorDestination(to);
  };
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between">
        <b className="text-sm">
          Door at {door.x}, {door.y}
        </b>
        <Button variant="ghost" size="sm" onClick={() => editor.selectDoor(-1)}>
          Done
        </Button>
      </div>
      <Field label="Leads to" hint="Visitors arrive at the matching door on the other side.">
        <Select value={door.to === "" ? "outside" : door.to} onValueChange={(value) => void lead(value)}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {door.to !== "?" ? (
        <Button variant="secondary" size="sm" onClick={() => session.openArea(door.to)}>
          <DoorOpen />
          Open {editor.mapName(door.to)}
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => editor.removeDoor()}>
        <Trash />
        Remove door
      </Button>
    </div>
  );
}
