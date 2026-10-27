"use client";

import { useEditor } from "@/components/editor/hooks";
import { SpeciesInput } from "@/components/editor/pokemon-picker";
import { CanvasView, Field, Hint, NumberInput, TextInput, Tip, useDraft } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { artwork, assets, npc as texture, portrait, preview, species } from "@/game/assets";
import type { Npc, NpcStory } from "@/game/data";
import { type Kind, kindOf, kinds } from "@/game/editor/constants";
import type { EditorEngine } from "@/game/editor/engine";
import { imageTypes, message, session } from "@/game/session";
import { creatureImage, key as spriteKey, scaleOf } from "@/game/sprites";
import { cn } from "@/lib/utils";
import { ArrowCounterClockwise, CaretLeft, Check, Eyedropper, PencilSimple, Plus, Trash, UploadSimple, UserSquare, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

/** Upload a custom sprite (resolves with its id) */
type OnSprite = (kind: "person" | "pokemon") => Promise<string | undefined>;

/** How someone looks, as a small preview */
function Look({ editor, npc, scale = 1 }: { editor: EditorEngine; npc: Npc; scale?: number }) {
  return (
    <CanvasView
      className="h-[30px] w-[34px] shrink-0 overflow-hidden"
      make={() => npc.creature ? portrait(npc.creature.species, scale, creatureImage(npc.creature.look)) : npc.sprite ? preview(texture(npc.sprite, "down"), scale * scaleOf(npc.sprite)) : editor.stampCanvas({ w: 1, h: 1, tiles: [206] }, 1.5)}
      deps={[npc.sprite, npc.creature?.species, npc.creature?.look]}
    />
  );
}

/** Display name of someone */
function label(npc: Npc) {
  return npc.name || (npc.creature ? species(npc.creature.species)?.name : kindOf(npc) === "sign" ? "Sign" : "Someone") || "Someone";
}

/** Short role tag of someone */
function tag(npc: Npc) {
  const kind = kindOf(npc);
  if (kind === "sign") {
    return "sign";
  }
  if (kind === "pokemon") {
    return npc.role === "wild" ? `wild · Lv ${npc.creature!.level}` : "Pokémon";
  }
  return npc.role === "trainer" ? (npc.trainer?.gym ? "gym leader" : "trainer") : npc.role === "healer" ? "nurse" : "talks";
}

/** Person / Pokémon / Sign tabs */
function Kinds({ editor, active, onPick }: { editor: EditorEngine; active: Kind; onPick: (kind: Kind) => void }) {
  const looks = { person: () => preview(texture("youngster", "down"), 1), pokemon: () => portrait(25, 1), sign: () => editor.stampCanvas({ w: 1, h: 1, tiles: [206] }, 2) };
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="What to place">
      {(Object.keys(kinds) as Kind[]).map((kind) => (
        <button key={kind} role="radio" aria-checked={kind === active} title={kinds[kind].title} onClick={() => onPick(kind)} className={cn("flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 text-xs font-medium transition-colors", kind === active ? "border-foreground bg-muted text-foreground" : "border-border bg-card text-muted-foreground hover:border-ring hover:text-foreground")}>
          <CanvasView className="h-[34px] overflow-hidden" make={looks[kind]} deps={[kind]} />
          {kinds[kind].label}
        </button>
      ))}
    </div>
  );
}

/** People panel: what clicking adds, everyone on this map, and the selected one's settings */
export function PeoplePanel({ onSprite }: { onSprite: OnSprite }) {
  const editor = useEditor();
  const npc = editor.city.npcs[editor.selected] as Npc | undefined;
  if (!npc) {
    const count = { person: 0, pokemon: 0, sign: 0 };
    editor.city.npcs.forEach((npc) => count[kindOf(npc)]++);
    const summary = [count.person && `${count.person} ${count.person > 1 ? "people" : "person"}`, count.pokemon && `${count.pokemon} Pokémon`, count.sign && `${count.sign} sign${count.sign > 1 ? "s" : ""}`].filter(Boolean).join(" · ") || "nobody yet";
    return (
      <div className="grid grid-cols-1 gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Add to the map</p>
        <Kinds editor={editor} active={editor.adding} onPick={(kind) => editor.setAdding(kind)} />
        <p className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"><Eyedropper size={13} className="shrink-0 text-select" />{kinds[editor.adding].hint}</p>
        <p className="mt-2 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">On this map<span className="font-normal normal-case tracking-normal">{summary}</span></p>
        {editor.city.npcs.length
          ? (
            <ul className="grid gap-0.5">
              {editor.city.npcs.map((npc, i) => (
                <li key={i}>
                  <button onClick={() => editor.selectNpc(i)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted">
                    <Look editor={editor} npc={npc} />
                    <span className="min-w-0 flex-1 truncate">{label(npc)}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px]", ["trainer", "wild"].includes(npc.role) ? "bg-destructive/15 text-red-300" : npc.role === "healer" ? "bg-pink-500/15 text-pink-300" : "bg-muted text-subtle-fg")}>{tag(npc)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
          : <p className="py-2 text-center text-xs text-subtle-fg">Click an empty tile on the map to add someone.</p>}
      </div>
    );
  }
  const kind = kindOf(npc);
  const update = (fn: () => void) => editor.mutate(fn);
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center gap-2">
        <Tip label="Back to everyone on this map"><button aria-label="Back" onClick={() => editor.selectNpc(-1)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><CaretLeft size={14} /></button></Tip>
        <Look editor={editor} npc={npc} />
        <div className="min-w-0 flex-1"><b className="block truncate text-sm">{label(npc)}</b><small className="text-[11px] text-subtle-fg">{kinds[kind].label} at {npc.x}, {npc.y}</small></div>
        <Tip label={`Remove this ${kinds[kind].label.toLowerCase()}`}><button aria-label="Remove" onClick={() => editor.deleteNpc()} className="grid size-7 place-items-center rounded-md text-subtle-fg hover:text-destructive"><Trash size={15} /></button></Tip>
      </div>
      <Kinds editor={editor} active={kind} onPick={(value) => editor.convertNpc(value)} />
      {kind === "sign" ? <SignForm npc={npc} update={update} /> : kind === "pokemon" ? <PokemonForm editor={editor} npc={npc} update={update} onSprite={onSprite} /> : <PersonForm editor={editor} npc={npc} update={update} onSprite={onSprite} />}
      <PersonStory editor={editor} npc={npc} update={update} />
    </div>
  );
}

type Update = (fn: () => void) => void;

/** Dialogue or message box (saves when leaving the field) */
function Words({ label, value, placeholder, onCommit, rows = 3 }: { label: string; value: string; placeholder: string; onCommit: (value: string) => void; rows?: number }) {
  const [text, setText] = useDraft(value);
  return <Field label={label}><Textarea rows={rows} value={text} placeholder={placeholder} onChange={(event) => setText(event.target.value)} onBlur={() => text !== value && onCommit(text)} /></Field>;
}

function SignForm({ npc, update }: { npc: Npc; update: Update }) {
  return (
    <>
      <Words label="Text" rows={4} value={npc.dialogue} placeholder="Route 101 · North to Oldale Town" onCommit={(text) => update(() => npc.dialogue = text)} />
      <Hint>Visitors read it by facing it and pressing Space. An empty line starts a new page. Signs are invisible, so keep a sign post or object under them.</Hint>
    </>
  );
}

function PersonForm({ editor, npc, update, onSprite }: { editor: EditorEngine; npc: Npc; update: Update; onSprite: OnSprite }) {
  const own = (editor.world.sprites ?? []).filter(({ kind }) => kind === "person").map(({ id, name }) => ({ id: spriteKey(id), name }));
  const looks = [...own.map(({ id, name }) => ({ id, name })), ...assets.npcs.map((name) => ({ id: name, name }))];
  return (
    <>
      <Field label="Name"><TextInput value={npc.name} maxLength={24} onCommit={(name) => update(() => npc.name = name)} className="h-8" /></Field>
      <Field label="Looks">
        <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto">
          <Tip label="Upload your own sprite" description="A walking sheet: 3 frames for each of the 4 directions">
            <button aria-label="Upload your own sprite" onClick={async () => { const id = await onSprite("person"); if (id) update(() => npc.sprite = spriteKey(id)); }} className="grid h-11 w-9 place-items-center rounded-md border border-dashed border-border text-muted-foreground hover:border-ring hover:text-foreground"><Plus size={16} /></button>
          </Tip>
          {looks.map(({ id, name }) => (
            <button key={id} title={name} onClick={() => update(() => npc.sprite = id)} className={cn("grid h-11 w-9 place-items-center rounded-md border bg-card", npc.sprite === id ? "border-select" : "border-border hover:border-ring")}>
              <CanvasView make={() => preview(texture(id, "down"), 1.5 * scaleOf(id))} deps={[id]} />
            </button>
          ))}
        </div>
      </Field>
      <PortraitField editor={editor} npc={npc} update={update} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Facing">
          <Select value={npc.dir} onValueChange={(dir) => update(() => npc.dir = dir as Npc["dir"])}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{["down", "up", "left", "right"].map((dir) => <SelectItem key={dir} value={dir}>{dir[0].toUpperCase() + dir.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Role">
          <Select value={npc.role} onValueChange={(role) => update(() => {
            npc.role = role as Npc["role"];
            if ((role === "trainer") && (!npc.trainer)) {
              npc.trainer = { team: [{ species: 263, level: 5 }], gym: false, badge: "", defeat: "You're tough!" };
              npc.wander = false;
              npc.dialogue = "Hey! Our eyes met, so we have to battle!";
            }
            if (role === "healer") {
              npc.dialogue = "Welcome to the Pokémon Center! Let me heal your Pokémon.";
            }
          })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="talk">Talks</SelectItem>
              <SelectItem value="trainer">Trainer (battles)</SelectItem>
              <SelectItem value="healer">Nurse (heals party)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Movement editor={editor} npc={npc} update={update} />
      <Words label="Dialogue" rows={4} value={npc.dialogue} placeholder="Leave an empty line to start a new page" onCommit={(text) => update(() => npc.dialogue = text)} />
      {(npc.role === "trainer") && (npc.trainer) ? <TrainerForm npc={npc} update={update} city={editor.city.name} /> : null}
    </>
  );
}

function TrainerForm({ npc, update, city }: { npc: Npc; update: Update; city: string }) {
  const trainer = npc.trainer!;
  return (
    <div className="grid grid-cols-1 gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Team ({trainer.team.length}/6)</p>
      {trainer.team.map((member, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <SpeciesInput value={member.species} onChange={(id) => update(() => member.species = id)} />
          <span className="text-xs text-subtle-fg">Lv</span>
          <NumberInput value={member.level} onCommit={(value) => update(() => member.level = value)} className="w-14" />
          <button aria-label="Remove from the team" title="Remove from the team" disabled={trainer.team.length <= 1} onClick={() => update(() => trainer.team.splice(i, 1))} className="grid size-7 shrink-0 place-items-center rounded text-subtle-fg hover:text-destructive disabled:opacity-30"><X size={13} /></button>
        </div>
      ))}
      {trainer.team.length < 6 ? <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => update(() => trainer.team.push({ species: 1 + Math.floor(Math.random() * assets.pokedex.length), level: trainer.team.at(-1)?.level ?? 5 }))}><Plus />Add Pokémon</Button> : null}
      <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground"><Checkbox checked={trainer.gym} onCheckedChange={(value) => update(() => trainer.gym = value === true)} />Gym leader (gives a badge)</Label>
      {trainer.gym ? <Field label="Badge name"><TextInput value={trainer.badge} placeholder={`${city} Badge`} onCommit={(badge) => update(() => trainer.badge = badge)} className="h-8" /></Field> : null}
      <Field label="When defeated"><TextInput value={trainer.defeat} onCommit={(text) => update(() => trainer.defeat = text)} className="h-8" /></Field>
      <Hint>Trainers spot visitors in front of them (4 tiles) and challenge them.</Hint>
    </div>
  );
}

function PokemonForm({ editor, npc, update, onSprite }: { editor: EditorEngine; npc: Npc; update: Update; onSprite: OnSprite }) {
  const creature = npc.creature!;
  const own = (editor.world.sprites ?? []).filter(({ kind }) => kind === "pokemon");
  const wild = npc.role === "wild";
  return (
    <>
      <div className="flex items-center gap-1.5">
        <SpeciesInput value={creature.species} onChange={(id) => update(() => {
          //Keep the name in sync while it is still the species name
          if ((!npc.name) || (npc.name === species(creature.species)?.name)) {
            npc.name = species(id).name;
          }
          creature.species = id;
        })} />
        <span className="text-xs text-subtle-fg">Lv</span>
        <NumberInput value={creature.level} onCommit={(value) => update(() => creature.level = value)} className="w-14" />
      </div>
      <Field label="Look">
        <div className="flex flex-wrap gap-1">
          {[{ id: "", name: `${species(creature.species)?.name} (default)` }, ...own].map(({ id, name }) => (
            <button key={id || "default"} title={name} onClick={() => update(() => id ? creature.look = id : delete creature.look)} className={cn("grid h-11 w-12 place-items-center overflow-hidden rounded-md border bg-card", (creature.look ?? "") === id ? "border-select" : "border-border hover:border-ring")}>
              <CanvasView make={() => portrait(creature.species, 0.75, id ? creatureImage(id) : "")} deps={[creature.species, id]} />
            </button>
          ))}
          <Tip label="Upload your own Pokémon sprite" description="One image, used on the map and in battle">
            <button aria-label="Upload your own Pokémon sprite" onClick={async () => { const id = await onSprite("pokemon"); if (id) update(() => creature.look = id); }} className="grid h-11 w-12 place-items-center rounded-md border border-dashed border-border text-muted-foreground hover:border-ring hover:text-foreground"><Plus size={16} /></button>
          </Tip>
        </div>
      </Field>
      <Field label="Name"><TextInput value={npc.name} maxLength={24} onCommit={(name) => update(() => npc.name = name)} className="h-8" /></Field>
      <PortraitField editor={editor} npc={npc} update={update} />
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">When the player talks to it</p>
        <div className="grid grid-cols-2 gap-1.5">
          {([["talk", "Makes its cry", "Says its message, like a friendly Pikachu"], ["wild", "Wild battle", "Battle it and try to catch it, like Snorlax"]] as const).map(([value, title, text]) => (
            <button key={value} aria-pressed={wild === (value === "wild")} onClick={() => update(() => {
              npc.role = value;
              //Wild encounters stay where they were placed
              if (value === "wild") {
                npc.wander = false;
                delete npc.path;
                if ((!npc.dialogue) || (npc.dialogue === "Pika pika!")) {
                  npc.dialogue = `The wild ${species(creature.species).name} stares at you!`;
                }
              }
            })} className={cn("flex flex-col items-start gap-0.5 rounded-lg border p-2 text-left", wild === (value === "wild") ? "border-foreground bg-muted" : "border-border bg-card hover:border-ring")}>
              <b className="text-xs">{title}</b><small className="text-[11px] leading-snug text-subtle-fg">{text}</small>
            </button>
          ))}
        </div>
      </div>
      <Movement editor={editor} npc={npc} update={update} />
      <Words label={wild ? "Before the battle" : "Cry or message"} value={npc.dialogue} placeholder={wild ? "Snorlax is fast asleep… It woke up!" : "Pika pika!"} onCommit={(text) => update(() => npc.dialogue = text)} />
      {wild ? <Hint>Visitors battle it as a wild Pokémon and can catch it. Once beaten or caught, it&apos;s gone for that player.</Hint> : null}
    </>
  );
}

/** Picture shown beside their dialogue: on or off, and the default (Pokémon artwork or their own map sprite), another sprite, or an uploaded image */
function PortraitField({ editor, npc, update }: { editor: EditorEngine; npc: Npc; update: Update }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const upload = async (file?: File) => {
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      const url = await session.uploadPortrait(file);
      update(() => npc.portrait = url);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  };
  const pick = (portrait: string) => {
    update(() => npc.portrait = portrait);
    setPicking(false);
  };
  const shown = !npc.hidePortrait;
  const creature = npc.creature;
  const sprite = npc.portrait?.startsWith("sprite:") ? npc.portrait.slice("sprite:".length) : "";
  const image = "size-full object-contain [image-rendering:pixelated]";
  //Sprites to pick from, and images already uploaded for others in this city
  const sprites = [...(editor.world.sprites ?? []).filter(({ kind }) => kind === "person").map(({ id, name }) => ({ id: spriteKey(id), name })), ...assets.npcs.map((name) => ({ id: name, name }))];
  const uploaded = [...new Set([editor.world, ...editor.world.interiors].flatMap((map) => map.npcs).map(({ portrait }) => portrait ?? "").filter((url) => url && !url.startsWith("sprite:")))];
  const status = npc.portrait ? (sprite ? `Sprite: ${sprites.find(({ id }) => id === sprite)?.name ?? sprite}` : "Your image") : creature ? "Default: its artwork" : "Default: their map sprite";
  return (
    <div className="grid gap-2 rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="show-portrait" className="text-xs font-medium text-muted-foreground">Portrait when talking</Label>
        <Switch id="show-portrait" checked={shown} onCheckedChange={(checked) => update(() => checked ? delete npc.hidePortrait : npc.hidePortrait = true)} />
      </div>
      {shown
        ? (
          <>
            <div className="flex items-center gap-2.5">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-[linear-gradient(#f8f8f4,#e4e4dc)]">
                {sprite
                  ? <CanvasView make={() => preview(texture(sprite, "down"), 2 * scaleOf(sprite))} deps={[sprite]} />
                  : npc.portrait
                  ? <img src={npc.portrait} alt="" className={image} />
                  : creature
                  ? <img src={creatureImage(creature.look) || artwork(creature.species)} alt="" className={image} />
                  : <CanvasView make={() => preview(texture(npc.sprite, "down"), 2 * scaleOf(npc.sprite))} deps={[npc.sprite]} />}
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="truncate text-xs text-foreground">{status}</span>
                <div className="flex flex-wrap gap-1">
                  <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => input.current?.click()}><UploadSimple />{busy ? "Uploading…" : "Upload"}</Button>
                  <Popover open={picking} onOpenChange={setPicking}>
                    <PopoverTrigger asChild><Button variant="secondary" size="sm" className="h-7 px-2 text-xs"><UserSquare />Pick a sprite</Button></PopoverTrigger>
                    <PopoverContent side="left" align="start" className="w-72 p-2">
                      {uploaded.length
                        ? (
                          <>
                            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Uploaded in this city</p>
                            <div className="mb-2 flex flex-wrap gap-1">
                              {uploaded.map((url) => (
                                <button key={url} onClick={() => pick(url)} className={cn("grid size-12 place-items-center overflow-hidden rounded-md border bg-[linear-gradient(#f8f8f4,#e4e4dc)]", npc.portrait === url ? "border-select" : "border-border hover:border-ring")}><img src={url} alt="" className={image} /></button>
                              ))}
                            </div>
                          </>
                        )
                        : null}
                      <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Sprites</p>
                      <div className="flex max-h-56 flex-wrap gap-1 overflow-y-auto">
                        {sprites.map(({ id, name }) => (
                          <button key={id} title={name} onClick={() => pick(`sprite:${id}`)} className={cn("grid h-11 w-9 place-items-center rounded-md border bg-card", sprite === id ? "border-select" : "border-border hover:border-ring")}>
                            <CanvasView make={() => preview(texture(id, "down"), 1.5 * scaleOf(id))} deps={[id]} />
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {npc.portrait ? <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => update(() => delete npc.portrait)}><ArrowCounterClockwise />Default</Button> : null}
                </div>
              </div>
              <input ref={input} type="file" accept={imageTypes.join(",")} hidden onChange={(event) => (upload(event.target.files?.[0]), event.target.value = "")} />
            </div>
            <Hint>For your own image: a square PNG with a transparent background, 96 to 256 px, from the waist up. Pixel art looks best.</Hint>
          </>
        )
        : <Hint>Their words show without a picture.</Hint>}
    </div>
  );
}

/** Movement: stays, wanders, or walks a path drawn on the map */
function Movement({ editor, npc, update }: { editor: EditorEngine; npc: Npc; update: Update }) {
  const index = editor.city.npcs.indexOf(npc);
  const mode = npc.path ? "path" : npc.wander ? "wander" : "still";
  const path = npc.path;
  const drawing = editor.pathing === index;
  const set = (value: "still" | "wander" | "path") => {
    update(() => {
      npc.wander = value === "wander";
      if (value !== "path") {
        delete npc.path;
      } else {
        npc.path ??= { points: [], loop: false, run: false, pause: 1 };
      }
    });
    if ((value === "path") && (!npc.path?.points.length)) {
      editor.startPath(index);
    }
  };
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">Movement</p>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Movement">
        {([["still", "Stays", "Stays where you placed them"], ["wander", "Wanders", "Strolls up to 2 tiles around where you placed them"], ["path", "Path", "Walks a route you draw on the map"]] as const).map(([value, label, title]) => (
          <button key={value} role="radio" aria-checked={mode === value} title={title} onClick={() => mode !== value && set(value)} className={cn("h-7 rounded text-xs", mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>
      {path
        ? (
          <div className={cn("grid gap-2 rounded-lg border bg-card p-2.5", drawing ? "border-select ring-1 ring-select/40" : "border-border")}>
            <div className="flex items-center gap-1">
              <b className="flex-1 text-xs">{path.points.length ? `${path.points.length} stop${path.points.length > 1 ? "s" : ""} after the start` : "No stops yet"}</b>
              {path.points.length && !drawing ? <Tip label="Remove the last stop"><button aria-label="Remove the last stop" onClick={() => update(() => path.points.pop())} className="grid size-6 place-items-center rounded text-subtle-fg hover:text-foreground"><ArrowCounterClockwise size={13} /></button></Tip> : null}
              {path.points.length && !drawing ? <Tip label="Clear the path"><button aria-label="Clear the path" onClick={() => update(() => path.points.length = 0)} className="grid size-6 place-items-center rounded text-subtle-fg hover:text-destructive"><Trash size={13} /></button></Tip> : null}
            </div>
            <Button variant={drawing ? "default" : "secondary"} size="sm" onClick={() => drawing ? editor.stopPath() : editor.startPath(index)}>{drawing ? <><Check />Done drawing</> : <><PencilSimple />{path.points.length ? "Edit the path" : "Draw the path"}</>}</Button>
            {drawing ? <Hint>Click tiles on the map to add stops in order. Between stops they walk across first, then up or down.</Hint> : null}
            <div className="grid grid-cols-[1fr_auto_auto] items-end gap-1.5">
              <Field label="At the end">
                <Select value={path.loop ? "loop" : "back"} onValueChange={(value) => update(() => path.loop = value === "loop")}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="back">Walk back</SelectItem><SelectItem value="loop">Loop to start</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Speed">
                <Select value={path.run ? "run" : "walk"} onValueChange={(value) => update(() => path.run = value === "run")}>
                  <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="walk">Walk</SelectItem><SelectItem value="run">Run</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Pause (s)"><NumberInput min={0} max={10} value={path.pause} onCommit={(value) => update(() => path.pause = value)} className="w-14" /></Field>
            </div>
          </div>
        )
        : null}
    </div>
  );
}

/** Story settings of someone: shows up, leaves, needs first, completes, reward */
function PersonStory({ editor, npc, update }: { editor: EditorEngine; npc: Npc; update: Update }) {
  const story = editor.city.story;
  if (!story.length) {
    return <div className="grid gap-1 border-t border-border pt-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Story</p><Hint>Add steps in the Story layer to make this {kindOf(npc) === "person" ? "person" : kindOf(npc) === "pokemon" ? "Pokémon" : "sign"} part of the story.</Hint></div>;
  }
  const settings = npc.story ?? {};
  const set = (key: keyof NpcStory, value: unknown) => update(() => {
    npc.story ??= {};
    if ((value === "") || (value === undefined)) {
      delete npc.story[key];
    } else {
      Object.assign(npc.story, { [key]: value });
    }
  });
  const step = (key: "after" | "until" | "requires" | "completes", label: string, empty: string) => (
    <Field label={label}>
      <Select value={settings[key] ?? "none"} onValueChange={(value) => set(key, value === "none" ? "" : value)}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{empty}</SelectItem>
          {story.map((item, i) => <SelectItem key={item.id} value={item.id}>{i + 1}. {item.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
  const reward = settings.reward ?? {};
  const completes = npc.role === "trainer" ? "Beating them completes" : npc.role === "wild" ? "Beating or catching it completes" : kindOf(npc) === "sign" ? "Reading it completes" : "Talking completes";
  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Story</p>
      {step("after", "Shows up", "From the start")}
      {step("until", "Leaves", "Never")}
      {step("requires", "Needs first", "Nothing")}
      {settings.requires ? <Field label="Says until then"><TextInput value={settings.locked ?? ""} placeholder="Come back later…" onCommit={(text) => set("locked", text)} className="h-8" /></Field> : null}
      {step("completes", completes, "No step")}
      {settings.completes
        ? (
          <div className="grid gap-2 rounded-lg border border-border bg-card p-2.5">
            <p className="text-xs font-medium text-muted-foreground">Reward</p>
            <div className="flex items-center gap-1.5">
              <SpeciesInput value={reward.species ?? 0} onChange={(id) => set("reward", { ...reward, species: id, level: reward.level ?? 5 })} />
              <span className="text-xs text-subtle-fg">Lv</span>
              <NumberInput value={reward.level ?? 5} onCommit={(value) => set("reward", { ...reward, level: value })} className="w-14" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Poké Balls</span><NumberInput min={0} max={99} value={reward.balls ?? 0} onCommit={(value) => set("reward", { ...reward, balls: value })} className="w-14" />
              <span>Potions</span><NumberInput min={0} max={99} value={reward.potions ?? 0} onCommit={(value) => set("reward", { ...reward, potions: value })} className="w-14" />
            </div>
            <Words label="Says afterwards" rows={2} value={settings.done ?? ""} placeholder="Good luck on your journey!" onCommit={(text) => set("done", text)} />
          </div>
        )
        : null}
    </div>
  );
}
