"use client";

import { cities, importTileset, newCity, settings, versionHistory } from "@/components/editor/city-dialogs";
import { useEditor, useSession } from "@/components/editor/hooks";
import { publish, share } from "@/components/editor/share-dialogs";
import { shortcutsSheet } from "@/components/editor/shortcuts";
import { startTour } from "@/components/editor/tour";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { species } from "@/game/assets";
import { brushes, terrains } from "@/game/brushes";
import { kindOf, type Stamp, targets, tools } from "@/game/editor/constants";
import { problems } from "@/game/problems";
import { ArrowArcLeft, ArrowArcRight, BookOpen, ClockCounterClockwise, Crosshair, DoorOpen, DownloadSimple, Export, Folder, GearSix, GridFour, Image as ImageIcon, Keyboard, MapTrifold, PaintBrush, PencilSimple, Play, Plus, ShareNetwork, Sparkle, Stack, User, Warning } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useState } from "react";

/** Command palette: Cmd+K (Ctrl+K) finds any action, tool, layer, stamp, map, person or problem by typing */
export function CommandPalette() {
  const session = useSession();
  const editor = useEditor();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.key.toLowerCase() === "k") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, []);

  if ((!session.ready) || (!editor)) {
    return null;
  }
  const building = !session.visiting;
  //Close the palette, then run the command (dialogs open once the palette is gone)
  const run = (fn: () => unknown) => () => (setOpen(false), setTimeout(() => void fn(), 0));
  const edit = async () => session.mode === "edit" ? undefined : await session.setMode("edit");
  const paint = (stamp: Stamp) => run(async () => (await edit(), editor.use(stamp)));
  const item = (key: string, label: string, icon: ReactNode, fn: () => unknown, shortcut?: string, keywords?: string[]) => (
    <CommandItem key={key} value={`${key} ${label}`} keywords={keywords} onSelect={run(fn)}>{icon}{label}{shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}</CommandItem>
  );
  const found = building ? problems(session.city, (id) => Boolean(species(id))) : [];
  const maps = [{ id: "", name: "Outside" }, ...session.city.interiors.map(({ id, name }) => ({ id, name }))];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Find an action, tool, layer, stamp, map or person">
      <CommandInput placeholder="Type a command, a stamp, a layer or someone's name…" />
      <CommandList>
        <CommandEmpty>Nothing matches. Try a tool, a layer, a stamp or a person&apos;s name.</CommandEmpty>
        {found.length
          ? (
            <CommandGroup heading={`Problems (${found.length})`}>
              {found.map((problem, i) => item(`problem-${i}`, problem.text, <Warning className={problem.kind === "error" ? "text-destructive" : "text-select"} />, () => session.fix(problem), undefined, ["problem", "fix"]))}
            </CommandGroup>
          )
          : null}
        <CommandGroup heading="Actions">
          {building ? item("build", "Build", <PencilSimple />, () => session.setMode("edit")) : null}
          {item("play", "Play", <Play />, () => session.setMode("play"))}
          {building ? item("play-spawn", "Play from where visitors arrive", <Play />, () => session.playFrom(null), "P", ["spawn", "test"]) : null}
          {building ? item("undo", "Undo", <ArrowArcLeft />, () => editor.undo(), "⌘Z") : null}
          {building ? item("redo", "Redo", <ArrowArcRight />, () => editor.redo(), "⇧⌘Z") : null}
          {building ? item("grid", "Show or hide the grid", <GridFour />, () => editor.toggleGrid(), "G") : null}
          {item("center", "Fit the map on screen", <Crosshair />, () => session.map.fit(), "0", ["center", "zoom"])}
          {building ? item("share", "Share or invite friends", <ShareNetwork />, () => share(), undefined, ["link", "room", "live"]) : null}
          {building ? item("publish", "Publish on Explore", <Export />, () => publish()) : null}
          {item("new", "New city", <Plus />, () => newCity())}
          {item("cities", "Your cities", <Folder />, () => cities(), undefined, ["open", "load"])}
          {building ? item("settings", "City settings", <GearSix />, () => settings(), undefined, ["size", "resize", "music", "tilesets", "sprites"]) : null}
          {(building) && (session.online) ? item("history", "Version history", <ClockCounterClockwise />, () => versionHistory(), undefined, ["restore", "backup", "rollback"]) : null}
          {building ? item("tileset", "Import a tileset", <ImageIcon />, () => importTileset()) : null}
          {item("image", "Export as image", <DownloadSimple />, () => session.exportImage(), undefined, ["png", "screenshot"])}
          {building ? item("json", "Export as .json", <DownloadSimple />, () => session.exportJson(), undefined, ["backup", "file"]) : null}
          {building ? item("tour", "Getting started tour", <Sparkle />, () => startTour(), undefined, ["help", "tutorial"]) : null}
          {item("shortcuts", "Keyboard shortcuts", <Keyboard />, () => shortcutsSheet(), "?", ["keys", "help", "cheat sheet"])}
          {item("docs", "Open the docs", <BookOpen />, () => window.open("/docs", "_blank"), undefined, ["help"])}
        </CommandGroup>
        {building
          ? (
            <>
              <CommandGroup heading="Tools">
                {tools.map(({ key, label, shortcut, tip }) => item(`tool-${key}`, label, <PaintBrush />, async () => (await edit(), editor.setTool(key)), shortcut, [tip]))}
              </CommandGroup>
              <CommandGroup heading="Layers">
                {targets.map(({ key, label, hint }, i) => item(`layer-${key}`, `${label} layer`, <Stack />, async () => (await edit(), editor.select(key)), `${i + 1}`, [hint]))}
              </CommandGroup>
              <CommandGroup heading="Stamps">
                {editor.favorites.map((favorite, i) => <CommandItem key={`favorite-${i}`} value={`favorite-${i} ${favorite.name}`} keywords={["favorite"]} onSelect={paint(favorite)}><Sparkle />{favorite.name}<CommandShortcut>favorite</CommandShortcut></CommandItem>)}
                {brushes.map((brush) => <CommandItem key={brush.name} value={`stamp ${brush.name}`} onSelect={paint(brush)}><PaintBrush />{brush.name}</CommandItem>)}
                {terrains.map((terrain) => <CommandItem key={terrain.id} value={`terrain ${terrain.name}`} keywords={["terrain"]} onSelect={paint({ w: 3, h: 3, tiles: terrain.tiles, name: terrain.name, terrain: terrain.id, layer: "decor", solid: "none" })}><PaintBrush />{terrain.name}<CommandShortcut>terrain</CommandShortcut></CommandItem>)}
              </CommandGroup>
            </>
          )
          : null}
        {maps.length > 1
          ? (
            <CommandGroup heading="Maps">
              {maps.map(({ id, name }) => item(`map-${id || "outside"}`, `Go to ${name}`, id ? <DoorOpen /> : <MapTrifold />, () => session.openArea(id)))}
            </CommandGroup>
          )
          : null}
        {building
          ? (
            <CommandGroup heading="On this map">
              {session.area.npcs.map((npc, i) => item(`npc-${i}`, `${npc.name || (kindOf(npc) === "sign" ? "Sign" : "Someone")} at ${npc.x}, ${npc.y}`, <User />, async () => {
                await edit();
                editor.select("npc");
                editor.selectNpc(i);
                session.map.center(npc.x + 0.5, npc.y + 0.5);
              }, undefined, [kindOf(npc), npc.dialogue.slice(0, 60)]))}
            </CommandGroup>
          )
          : null}
      </CommandList>
    </CommandDialog>
  );
}
