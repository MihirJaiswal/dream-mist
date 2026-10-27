"use client";

import { confirm, signIn } from "@/components/editor/account-dialogs";
import { openDialog } from "@/components/editor/dialogs";
import { Field, Hint } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Card, cloud } from "@/game/cloud";
import { label, type Section, sections } from "@/game/hoenn";
import { message, session } from "@/game/session";
import { frameOf, image as loadImage, layouts } from "@/game/sprites";
import { cn } from "@/lib/utils";
import { CaretDown, CheckCircle, Copy, Image as ImageIcon, MusicNotes, Plus, Sparkle, Stack, Trash, TreeEvergreen, Upload, User, Warning, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

//=================================================================================================
// New city

export function newCity() {
  return openDialog<void>((close) => <NewCity close={close} />);
}

function NewCity({ close }: { close: () => void }) {
  const [name, setName] = useState("");
  const [list, setList] = useState<Section[] | null>(null);
  const [, refresh] = useState(0);
  const previous = session.visiting ? null : session.city?.name;
  useEffect(() => void sections().then(setList), []);
  const start = async (start: Parameters<typeof session.create>[0]) => {
    close();
    try {
      await session.create(start, name.trim() || "New Town");
    } catch (error) {
      toast.error(`Failed to start: ${message(error)}`);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>New city</DialogTitle><DialogDescription className="sr-only">Start a new town</DialogDescription></DialogHeader>
        {(!cloud.user) && (cloud.available)
          ? (
            <div className="flex items-start gap-3 rounded-lg border border-select/45 bg-select/10 p-3">
              <Warning size={18} className="mt-0.5 shrink-0 text-select" />
              <div className="flex-1"><b className="block text-sm">You&apos;re not logged in</b><small className="text-xs text-muted-foreground">{previous ? `${previous} and your new town are` : "Your new town is"} only saved in this browser. Clearing browser data or switching devices would lose them.</small></div>
              <Button size="sm" variant="secondary" onClick={async () => (await signIn("new"), refresh((n) => n + 1))}>Log in</Button>
            </div>
          )
          : previous ? <p className="flex items-center gap-1.5 text-xs text-success"><CheckCircle size={14} />{previous} is saved{cloud.user ? " to your account" : ""}. Reopen it anytime from Your cities.</p> : null}
        <Field label="Name"><Input value={name} placeholder="Littleroot Heights" maxLength={40} onChange={(event) => setName(event.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => start({ kind: "starter" })} className="grid gap-1 rounded-lg border border-border bg-card p-3 text-left hover:border-ring"><TreeEvergreen size={20} /><b className="text-sm">Starter town</b><small className="text-xs text-muted-foreground">Trees, paths, a Pokémon Center, a house and tall grass</small></button>
          <button onClick={() => start({ kind: "empty" })} className="grid gap-1 rounded-lg border border-border bg-card p-3 text-left hover:border-ring"><Stack size={20} /><b className="text-sm">Empty field</b><small className="text-xs text-muted-foreground">A blank 40×30 grass map</small></button>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Or start from a real Hoenn location</p>
        <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
          {list
            ? list.map((section) => <button key={section.id} title={`${section.width}×${section.height}`} onClick={() => start({ kind: "hoenn", section }).then(() => toast.info(`Loaded ${label(section.id)}`, { description: "Check collisions before sharing it." }))} className="h-7 rounded-full border border-border px-3 text-xs text-muted-foreground hover:border-ring hover:text-foreground">{label(section.id)}</button>)
            : <Hint>Loading Hoenn maps…</Hint>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Your cities

export function cities() {
  return openDialog<void>((close) => <Cities close={close} />);
}

function Cities({ close }: { close: () => void }) {
  const [online, setOnline] = useState<Card[] | null | Error>(null);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (cloud.user) {
      cloud.cities.list().then(setOnline, (error) => (setOnline(error), toast.error("Couldn't load your online cities", { description: message(error) })));
    }
  }, []);
  const local = session.localCities();
  const row = (title: string, detail: string, current: boolean, actions: React.ReactNode) => (
    <div className={cn("flex items-center gap-2 rounded-md border p-2.5", current ? "border-ring bg-muted/40" : "border-border")}>
      <div className="min-w-0 flex-1"><b className="block truncate text-sm">{title}</b><small className="text-xs text-subtle-fg">{detail}</small></div>
      {actions}
    </div>
  );
  const run = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      close();
    } catch (error) {
      toast.error(message(error));
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Your cities</DialogTitle><DialogDescription className="sr-only">Cities in your account and in this browser</DialogDescription></DialogHeader>
        <div className="flex gap-2">
          <Button onClick={() => (close(), newCity())}><Plus />New city</Button>
          <Button variant="outline" onClick={() => {
            const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json,.txt" });
            input.onchange = async () => {
              const file = input.files?.[0];
              if (file) {
                const text = (await file.text()).trim();
                await run(() => session.importText(text))();
              }
            };
            input.click();
          }}><Upload />Import file</Button>
        </div>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto">
          <section className="grid gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Online</p>
            {!cloud.user
              ? <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"><span className="flex-1">{cloud.available ? "Log in to keep your cities online and open them from any device." : "Online saves aren't set up on this site."}</span>{cloud.available ? <Button size="sm" variant="secondary" onClick={async () => (close(), await signIn(), cities())}>Log in</Button> : null}</div>
              : online instanceof Error ? <Hint>Your online cities couldn&apos;t be loaded. Reopen this window to try again.</Hint>
              : online === null ? <Hint>Loading…</Hint>
              : online.length ? online.map((card) => row(card.name, `${card.width}×${card.height} · ${card.mine ? "yours" : `by ${card.owner}, you're a builder`}${card.published ? " · on Explore" : ""} · ${new Date(card.updated).toLocaleDateString()}`, card.id === session.online?.id, (
                <>
                  <Button size="sm" variant="outline" onClick={run(() => session.openOnline(card.id))}>Open</Button>
                  {card.mine ? <Button size="icon" variant="ghost" aria-label="Delete" title="Delete" onClick={async () => {
                    if (await confirm(`Delete ${card.name}?`, { text: "It is removed from your account and its share links stop working.", action: "Delete", danger: true })) {
                      await session.deleteOnline(card.id).catch((error) => toast.error(message(error)));
                      setOnline((list) => Array.isArray(list) ? list.filter(({ id }) => id !== card.id) : list);
                    }
                  }}><Trash className="text-destructive" /></Button> : null}
                </>
              )))
              : <Hint>No cities online yet. Use Share → Save online, or bring one from this browser.</Hint>}
          </section>
          <section className="grid gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">On this device</p>
            {local.length ? local.map((city) => row(city.name, `${city.width}×${city.height} · ${city.npcs.length} on the map · ${new Date(city.updated).toLocaleDateString()}`, (city.id === session.city?.id) && (!session.visiting), (
              <>
                <Button size="sm" variant="outline" onClick={run(() => session.openLocal(city.id))}>Open</Button>
                {cloud.user ? <Button size="icon" variant="ghost" aria-label="Save to your account" title="Save to your account" onClick={run(async () => (await session.openLocal(city.id), await session.upload()))}><Upload /></Button> : null}
                <Button size="icon" variant="ghost" aria-label="Delete" title="Delete" onClick={async () => {
                  if (await confirm(`Delete ${city.name}?`, { text: "This removes it from this device and can't be undone.", action: "Delete", danger: true })) {
                    session.deleteLocal(city.id);
                    refresh((n) => n + 1);
                  }
                }}><Trash className="text-destructive" /></Button>
              </>
            ))) : <Hint>No cities saved on this device.</Hint>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// City settings

export function settings() {
  return openDialog<void>((close) => <Settings close={close} />);
}

/** Pick a file */
function pick(accept: string) {
  return new Promise<File | null>((solve) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept });
    input.onchange = () => solve(input.files?.[0] ?? null);
    input.click();
  });
}

/** Without an account images are stored inside the city: warn about it, and refuse ones over the limit */
function allowUpload(file: File, limit: number) {
  if (cloud.user) {
    return true;
  }
  const action = cloud.available ? { label: "Log in", onClick: () => void signIn("upload") } : undefined;
  if (file.size > limit) {
    toast.error(`This image is too big without an account (${Math.ceil(file.size / 1024)} KB)`, { description: `Images up to ${limit / 1024} KB can be stored inside the city.${cloud.available ? " Log in to upload bigger ones." : ""}`, action });
    return false;
  }
  toast.warning("You're not logged in", { description: "The image is stored inside the city, which makes share links bigger.", action });
  return true;
}

/** Header of a collapsible section */
function Fold({ children }: { children: React.ReactNode }) {
  return (
    <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-semibold">
      {children}
      <CaretDown size={14} className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
}

/** Prompt for AI image generators, with a copy button */
function AiPrompt({ prompt, children }: { prompt: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-border p-3">
      {children}
      <Hint>Paste this into an image generator and replace the part in brackets. Most tools draw bigger than asked: generate it large, then shrink it to the exact size with nearest-neighbor scaling (Aseprite, Piskel, LibreSprite, or GIMP with interpolation set to None) so the pixels stay sharp.</Hint>
      <Textarea readOnly rows={9} value={prompt} className="max-h-56 font-mono text-xs" />
      <Button variant="outline" size="sm" className="justify-self-end" onClick={() => navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt copied"), () => toast.warning("Couldn't copy: select the text and copy it"))}><Copy />Copy prompt</Button>
    </div>
  );
}

function Settings({ close }: { close: () => void }) {
  const area = session.area;
  const city = session.city;
  const [width, setWidth] = useState(`${area.width}`);
  const [height, setHeight] = useState(`${area.height}`);
  const [, refresh] = useState(0);
  const update = () => refresh((n) => n + 1);
  const row = "flex items-center gap-3 rounded-md border border-border p-2.5";
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>City settings</DialogTitle><DialogDescription className="sr-only">Map size, music, tilesets and sprites</DialogDescription></DialogHeader>
        <section className="grid grid-cols-1 gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">{area === city ? "Map size" : `${area.name} size`}</p>
          <div className="flex items-center gap-2">
            <Input type="number" min={6} max={128} value={width} onChange={(event) => setWidth(event.target.value)} className="w-24" aria-label="Width" />
            <span className="text-muted-foreground">×</span>
            <Input type="number" min={6} max={128} value={height} onChange={(event) => setHeight(event.target.value)} className="w-24" aria-label="Height" />
            <Button variant="secondary" size="sm" onClick={() => (session.resizeArea(Number(width) || area.width, Number(height) || area.height), update())}>Resize</Button>
          </div>
          <Hint>Content stays anchored to the top-left corner. Resizing clears undo history.</Hint>
        </section>
        <section className="grid grid-cols-1 gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Music</p>
          {(["town", "battle"] as const).map((track) => {
            const custom = city.music?.[track];
            return (
              <div key={track} className={row}>
                <MusicNotes size={16} />
                <div className="min-w-0 flex-1"><b className="block text-sm">{track === "town" ? "Town music" : "Battle music"}</b><small className="text-xs text-subtle-fg">{custom ? "Custom upload" : "DreamMist default"}</small></div>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!cloud.user) {
                    return cloud.available ? toast.warning("Log in to upload music", { description: "Music files are stored in your account.", action: { label: "Log in", onClick: () => void signIn("upload") } }) : toast.error("Music uploads need online features to be set up");
                  }
                  const file = await pick("audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,audio/webm,audio/aac,.mp3,.m4a,.ogg,.wav");
                  if (file) {
                    await session.uploadMusic(track, file).then(() => (toast.success("Music uploaded"), update()), (error) => toast.error(message(error)));
                  }
                }}><Upload />{custom ? "Replace" : "Upload"}</Button>
                {custom ? <Button size="icon" variant="ghost" aria-label="Use default music" title="Use default music" onClick={() => (session.resetMusic(track), update())}><X /></Button> : null}
              </div>
            );
          })}
        </section>
        <section className="grid grid-cols-1 gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Tilesets</p>
          {(city.tilesets ?? []).map((sheet, index) => sheet.url ? (
            <div key={sheet.id} className={row}>
              <ImageIcon size={16} />
              <div className="min-w-0 flex-1"><b className="block truncate text-sm">{sheet.name}</b><small className="text-xs text-subtle-fg">{sheet.columns}×{sheet.rows} tiles of {sheet.tile}px</small></div>
              <Button size="icon" variant="ghost" aria-label="Remove tileset" title="Remove tileset" onClick={async () => {
                if (await confirm(`Remove ${sheet.name}?`, { text: "Tiles drawn with this tileset will be erased.", action: "Remove", danger: true })) {
                  await session.removeTileset(index);
                  update();
                }
              }}><Trash className="text-destructive" /></Button>
            </div>
          ) : null)}
          {(city.tilesets ?? []).every(({ url }) => !url) ? <Hint>Only the built-in Hoenn tileset is used.</Hint> : null}
          <Button variant="outline" size="sm" className="justify-self-start" onClick={async () => (await importTileset(), update())}><Plus />Import tileset</Button>
        </section>
        <section className="grid grid-cols-1 gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Sprites for people and Pokémon</p>
          {(city.sprites ?? []).map((sprite) => (
            <div key={sprite.id} className={row}>
              {sprite.kind === "person" ? <User size={16} /> : <Sparkle size={16} />}
              <div className="min-w-0 flex-1"><b className="block truncate text-sm">{sprite.name}</b><small className="text-xs text-subtle-fg">{sprite.kind === "person" ? `Person · ${layouts[sprite.layout ?? "dreammist"].label}` : "Pokémon"} · {sprite.w}×{sprite.h} px frames</small></div>
              <Button size="icon" variant="ghost" aria-label="Remove sprite" title="Remove sprite" onClick={async () => {
                if (await confirm(`Remove ${sprite.name}?`, { text: "Everyone using it goes back to a default look.", action: "Remove", danger: true })) {
                  await session.removeSprite(sprite.id);
                  update();
                }
              }}><Trash className="text-destructive" /></Button>
            </div>
          ))}
          {(city.sprites ?? []).length ? null : <Hint>No custom sprites yet.</Hint>}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => (await importSprite("person"), update())}><Plus />Person sprite</Button>
            <Button variant="outline" size="sm" onClick={async () => (await importSprite("pokemon"), update())}><Plus />Pokémon sprite</Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Import a tileset

/** Kinds of tilesets, and a prompt for AI image generators for each (the tile size goes into the layout) */
const tilesetKinds = {
  ground: {
    label: "Ground",
    hint: "Terrain painted on the Ground layer: grass, paths, water. Tiles are solid and repeat seamlessly.",
    prompt: (tile: number) => `Pixel art top-down tileset for a Pokémon-style game, in the style of Pokémon Ruby, Sapphire and Emerald (Game Boy Advance).
Theme: [describe the place, for example a snowy mountain village].
Contents: ground tiles only: plain ground, tall grass, a path, sand or dirt, water, flowers, and the edge and corner pieces where each path or water area meets the plain ground (a 3×3 block per terrain: four corners, four edges and the center).
Layout: a grid of 8 columns and 8 rows where every tile is exactly ${tile}×${tile} pixels (the whole image is ${tile * 8}×${tile * 8} pixels), with no spacing, margins or gaps between tiles.
Style: straight top-down view, crisp pixels, no anti-aliasing, no blur, a limited palette, soft GBA colors, every center tile seamless when repeated next to itself.
Every tile is fully opaque. No text, no grid lines, no labels, no border.`,
  },
  objects: {
    label: "Buildings and nature",
    hint: "Things placed on the Objects and Above layers: houses, trees, fences, signs. The background is transparent.",
    prompt: (tile: number) => `Pixel art top-down tileset of objects for a Pokémon-style game, in the style of Pokémon Ruby, Sapphire and Emerald (Game Boy Advance).
Theme: [describe the place, for example a seaside fishing town].
Contents: [list what you need, for example two small houses, a shop, trees, bushes, rocks, a fence, a mailbox, a sign post, flower pots].
Layout: everything lined up on a grid of ${tile}×${tile} pixel tiles, 8 tiles wide (${tile * 8} pixels wide), with no spacing or margins. Big objects like houses and trees span several whole tiles and start exactly on a tile edge. Leave empty tiles fully transparent.
Style: 3/4 top-down view like the Game Boy Advance games, crisp pixels, no anti-aliasing, no blur, a limited palette, a 1-pixel dark outline.
Background: fully transparent. No ground under the objects, no shadows on the ground, no text, no grid lines, no border.`,
  },
  indoor: {
    label: "Inside",
    hint: "Interiors: floors, walls, doors, windows and furniture for houses, shops and gyms.",
    prompt: (tile: number) => `Pixel art top-down interior tileset for a Pokémon-style game, in the style of the house and Pokémon Center interiors in Pokémon Ruby, Sapphire and Emerald (Game Boy Advance).
Theme: [describe the room, for example a cozy wooden cabin or a modern gym].
Contents: floor tiles that repeat seamlessly, a back wall with a top edge, a doorway and a door mat, windows, a bed, a table and chairs, a bookshelf, a TV, plants, a rug, stairs.
Layout: everything lined up on a grid of ${tile}×${tile} pixel tiles, 8 tiles wide (${tile * 8} pixels wide), with no spacing or margins. Furniture spans whole tiles and starts exactly on a tile edge.
Style: 3/4 top-down view, crisp pixels, no anti-aliasing, no blur, a limited palette, a 1-pixel dark outline.
Background: floor and wall tiles are fully opaque; around furniture and on empty tiles the background is fully transparent. No text, no grid lines, no border.`,
  },
};

export function importTileset() {
  return openDialog<void>((close) => <ImportTileset close={close} />);
}

function ImportTileset({ close }: { close: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [tile, setTile] = useState("16");
  const [kind, setKind] = useState<keyof typeof tilesetKinds>("ground");
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Import tileset</DialogTitle><DialogDescription>PNG, WebP or GIF tileset laid out on a grid, no spacing.</DialogDescription></DialogHeader>
        <button onClick={async () => {
          const chosen = await pick("image/png,image/webp,image/gif");
          if ((chosen) && (allowUpload(chosen, 512 * 1024))) {
            setFile(chosen);
            setName((current) => current || chosen.name.replace(/\.\w+$/, "").slice(0, 30));
          }
        }} className="grid min-h-36 place-items-center gap-1 rounded-md border border-dashed border-border p-4 text-center text-muted-foreground hover:border-ring">
          {file ? <><img src={preview} alt="" className="max-h-48 max-w-full [image-rendering:pixelated]" /><small>{file.name} · {(file.size / 1024).toFixed(0)} KB</small></> : <><ImageIcon size={24} /><b className="text-sm text-foreground">Choose an image</b></>}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name"><Input value={name} placeholder="My tileset" maxLength={30} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Tile size">
            <Select value={tile} onValueChange={setTile}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[16, 24, 32, 48, 64].map((n) => <SelectItem key={n} value={`${n}`}>{n} × {n} px</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Collapsible className="rounded-lg border border-border bg-card">
          <Fold>What makes a good tileset</Fold>
          <CollapsibleContent>
            <ul className="grid list-disc gap-1.5 border-t border-border py-3 pr-3 pl-7 text-xs leading-relaxed text-muted-foreground">
              <li><b>A grid</b> of square tiles, all the same size, starting at the top-left corner with <b>no spacing or margins</b>. Pick that size under <b>Tile size</b>.</li>
              <li><b>Width and height</b> a multiple of the tile size, for example 128×128 px for 8 × 8 tiles of 16 px. Extra pixels on the right or bottom are cut off.</li>
              <li><b>16 px tiles</b> match the built-in Hoenn tiles. Bigger tiles are shrunk to fit the same grid on the map.</li>
              <li><b>Transparent background</b> for objects, so the ground shows through. Ground tiles should be solid.</li>
              <li><b>Big things</b> like houses span several tiles: select them together in the palette and paint them as one stamp.</li>
              <li><b>Up to 512 KB</b> without an account, 4 MB when logged in. Fully empty tiles paint nothing, so they never cover what is below.</li>
            </ul>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible className="rounded-lg border border-border bg-card">
          <Fold>Make it with AI</Fold>
          <CollapsibleContent>
            <AiPrompt prompt={tilesetKinds[kind].prompt(Number(tile))}>
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5">
                {Object.entries(tilesetKinds).map(([key, { label }]) => (
                  <button key={key} aria-pressed={kind === key} onClick={() => setKind(key as typeof kind)} className={cn("rounded px-2 py-1 text-xs", kind === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
                ))}
              </div>
              <Hint>{tilesetKinds[kind].hint} The prompt uses the tile size chosen above ({tile} px). AI tools rarely line tiles up perfectly: check the grid in a pixel editor before importing.</Hint>
            </AiPrompt>
          </CollapsibleContent>
        </Collapsible>
        <Button disabled={!file || busy} onClick={async () => {
          setBusy(true);
          try {
            const sheet = await session.addTileset(file!, name, Number(tile));
            close();
            toast.success(`${sheet.name} added: pick it above the tile palette`);
          } catch (error) {
            toast.error(message(error));
            setBusy(false);
          }
        }}>Add tileset</Button>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Upload a custom sprite

/** Prompts for AI image generators */
export const prompts = {
  person: `Pixel art character sprite sheet for a top-down Pokémon game, in the style of Pokémon Ruby, Sapphire and Emerald (Game Boy Advance).
Character: [describe your character, for example a young ranger with a green cap, a brown vest and a backpack].
Layout: a grid of 3 columns and 4 rows where every cell is exactly the same size, 16×32 pixels per cell (the whole image is 48×128 pixels).
Rows from top to bottom: facing down (toward the viewer), facing up (away from the viewer), facing left, facing right.
Columns from left to right: standing still, left foot forward, right foot forward.
Style: crisp pixels, no anti-aliasing, no blur, a limited palette of about 16 colors, a 1-pixel dark outline, a 3/4 top-down view, the feet touching the bottom of each cell, the same character and proportions in every cell.
Background: fully transparent. No text, no grid lines, no shadow, no border.`,
  pokemon: `Pixel art sprite of an original creature for a Pokémon-style game, in the style of the Pokémon Black and White battle sprites.
Creature: [describe your creature, for example a small fire fox with a flame-tipped tail].
Pose: full body, front 3/4 view, facing left, centered, the feet touching the bottom of the image.
Size: 64×64 pixels.
Style: crisp pixels, no anti-aliasing, no blur, a limited palette of about 16 colors, a 1-pixel dark outline, bright readable colors.
Background: fully transparent. No text, no shadow, no border.`,
};

/** Upload a custom sprite, resolves with its id */
export function importSprite(kind: "person" | "pokemon") {
  return openDialog<string>((close) => <ImportSprite kind={kind} close={close} />);
}

/** Frame preview walking in place */
function Frames({ image, layout }: { image: HTMLImageElement; layout: keyof typeof layouts }) {
  const frame = frameOf(image, layout);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((n) => n + 1), 220);
    return () => clearInterval(timer);
  }, []);
  if (!frame) {
    return <Warning size={24} />;
  }
  const { rows, frames } = layouts[layout];
  const zoom = Math.max(1, Math.floor(64 / frame.h));
  return (
    <div className="flex flex-wrap items-end justify-center gap-3.5">
      {rows.map((dir, row) => (
        <figure key={dir} className="m-0 grid justify-items-center gap-1">
          <canvas
            width={frame.w * zoom}
            height={frame.h * zoom}
            className="rounded bg-[repeating-conic-gradient(#262626_0_25%,#1c1c1c_0_50%)] bg-[length:8px_8px] [image-rendering:pixelated]"
            ref={(canvas) => {
              const context = canvas?.getContext("2d");
              if (context) {
                context.imageSmoothingEnabled = false;
                context.clearRect(0, 0, canvas!.width, canvas!.height);
                context.drawImage(image, frames[step % 3] * frame.w, row * frame.h, frame.w, frame.h, 0, 0, canvas!.width, canvas!.height);
              }
            }}
          />
          <figcaption className="font-mono text-[10.5px] text-subtle-fg">{dir}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function ImportSprite({ kind, close }: { kind: "person" | "pokemon"; close: (id?: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<keyof typeof layouts>("dreammist");
  const [busy, setBusy] = useState(false);
  const ok = image ? (kind === "pokemon" ? (image.width <= 256) && (image.height <= 256) : Boolean(frameOf(image, layout))) : false;
  const frame = image && kind === "person" ? frameOf(image, layout) : null;
  //Tell how the image fits as soon as it's picked or the layout changes
  useEffect(() => {
    if (!image) {
      return;
    }
    const id = "sprite-check";
    if (kind === "pokemon") {
      if (!ok) {
        toast.error("This image is too big", { id, description: `It's ${image.width}×${image.height} px: use 256×256 px or less.` });
      } else if (Math.max(image.width, image.height) > 96) {
        toast.warning(`${image.width}×${image.height} px works`, { id, description: "64×64 to 96×96 px looks closest to the games." });
      } else {
        toast.success(`${image.width}×${image.height} px, looks good`, { id });
      }
    } else if (!frame) {
      toast.error("This image doesn't match the layout", { id, description: `It doesn't split into ${layouts[layout].columns} columns and ${layouts[layout].rows.length} rows of equal frames. Pick another layout, or resize it to a multiple of ${layouts[layout].columns}×${layouts[layout].rows.length}.` });
    } else if ((frame.w !== 16) || (frame.h !== 32)) {
      toast.warning(`Frames of ${frame.w}×${frame.h} px`, { id, description: "They're scaled to one tile wide on the map. Check each direction walks the right way." });
    } else {
      toast.success("Frames of 16×32 px", { id, description: "Same size as the game's own characters. Check each direction walks the right way." });
    }
  }, [image, layout, kind, ok, frame?.w, frame?.h]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{kind === "person" ? "Upload a person sprite" : "Upload a Pokémon sprite"}</DialogTitle><DialogDescription className="sr-only">Upload your own sprite</DialogDescription></DialogHeader>
        <button onClick={async () => {
          const chosen = await pick("image/png,image/webp,image/gif");
          if ((!chosen) || (!allowUpload(chosen, 256 * 1024))) {
            return;
          }
          const loaded = await loadImage(URL.createObjectURL(chosen));
          setFile(chosen);
          setImage(loaded);
          setName((current) => current || chosen.name.replace(/\.\w+$/, "").slice(0, 30));
          //4 columns can only be RPG Maker XP, 3 columns default to DreamMist (VX/MV sheets look alike, pick them by hand)
          if (kind === "person") {
            setLayout((!frameOf(loaded, "dreammist")) && (frameOf(loaded, "rpgxp")) ? "rpgxp" : "dreammist");
          }
        }} className="grid min-h-36 place-items-center gap-2 rounded-md border border-dashed border-border p-4 text-center text-muted-foreground hover:border-ring">
          {image && file
            ? <>{kind === "person" ? <Frames image={image} layout={layout} /> : <img src={image.src} alt="" style={{ width: image.width * 2 }} className="max-w-full [image-rendering:pixelated]" />}<small>{file.name} · {image.width}×{image.height} px</small></>
            : <><ImageIcon size={24} /><b className="text-sm text-foreground">Choose an image</b><small>PNG, WebP or GIF with a transparent background</small></>}
        </button>
        <div className={cn("grid gap-2", kind === "person" && "grid-cols-2")}>
          <Field label="Name"><Input value={name} placeholder={kind === "person" ? "Ranger Jo" : "Flamefox"} maxLength={30} onChange={(event) => setName(event.target.value)} /></Field>
          {kind === "person"
            ? (
              <Field label="Layout">
                <Select value={layout} onValueChange={(value) => setLayout(value as keyof typeof layouts)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(layouts).map(([value, { label }]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )
            : null}
        </div>
        <Collapsible defaultOpen className="rounded-lg border border-border bg-card">
          <Fold>Size and layout</Fold>
          <CollapsibleContent>
          <ul className="list-disc space-y-1 border-t border-border px-7 py-3 text-xs text-muted-foreground [&_b]:text-foreground">
            {kind === "person"
              ? (
                <>
                  <li><b>Sheet:</b> 3 columns × 4 rows, every frame the same size.</li>
                  <li><b>Frame:</b> 16×32 px like the game&apos;s characters (whole image 48×128). 32×32, 32×48 or 32×64 also work.</li>
                  <li><b>Rows:</b> facing down, up, left, right.</li>
                  <li><b>Columns:</b> standing, left foot forward, right foot forward.</li>
                  <li><b>Background:</b> transparent, feet at the bottom of each frame.</li>
                  <li><b>RPG Maker sheets</b> work too: pick their layout above.</li>
                </>
              )
              : (
                <>
                  <li><b>One image</b> of the whole Pokémon, facing left (it&apos;s flipped when it walks right).</li>
                  <li><b>Size:</b> 64×64 px is ideal, from 32×32 up to 96×96. 256×256 at most.</li>
                  <li><b>Background:</b> transparent, feet near the bottom.</li>
                  <li><b>Used</b> on the map and in battle. Its species still decides types, stats and moves.</li>
                </>
              )}
          </ul>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible className="rounded-lg border border-border bg-card">
          <Fold>Make it with AI</Fold>
          <CollapsibleContent><AiPrompt prompt={prompts[kind]} /></CollapsibleContent>
        </Collapsible>
        <DialogFooter>
          <Button disabled={!ok || busy} onClick={async () => {
            setBusy(true);
            try {
              const sprite = await session.addSprite(file!, image!, kind, name, layout);
              close(sprite.id);
              toast.success(`${sprite.name} added`);
            } catch (error) {
              toast.error(message(error));
              setBusy(false);
            }
          }}>Add sprite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Publish description textarea (shared with the publish dialog) */
export function Description({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Textarea rows={3} maxLength={280} placeholder="A cozy seaside town with a tricky gym and a hidden cave…" value={value} onChange={(event) => onChange(event.target.value)} />;
}
