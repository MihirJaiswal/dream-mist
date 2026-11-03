"use client";

import { openDialog } from "@/components/editor/dialogs";
import { useEditor } from "@/components/editor/hooks";
import { SpeciesInput, TypeBadge } from "@/components/editor/pokemon-picker";
import { CanvasView, NumberInput, TextInput, Tip, useDraft } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { abilityAbout, abilityName } from "@/game/abilities";
import { artwork, assets, type Move, npc as texture, portrait, preview, species } from "@/game/assets";
import { colors, effectiveness } from "@/game/battle";
import { type BattleRules, type Member, type Npc, scenePicture, scenes } from "@/game/data";
import { holdable, type ItemId, items } from "@/game/items";
import { type Nature, natureIds, natureLabel, natures, statNames } from "@/game/natures";
import { message, session } from "@/game/session";
import { scaleOf } from "@/game/sprites";
import { type Creature, create, heal, learned, stat, trainer } from "@/game/trainer";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, CloudRain, MapTrifold, Play, Plus, Prohibit, Snowflake, Sparkle, Sun, Trash, Wind, X } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

/** Open the battle designer of a trainer (by their index on the open map) */
export function battleDesigner(index: number) {
  return openDialog<void>((close) => <Designer index={index} close={close} />);
}

/** A test party member (kept in this browser between tests) */
type Tester = { species: number; level: number };

/** Saved test team, or the three Hoenn starters at a level */
function testers(level: number): Tester[] {
  try {
    const saved = JSON.parse(localStorage.getItem("dreammist.test-team") ?? "null");
    if (Array.isArray(saved) && saved.length) {
      return saved.slice(0, 6);
    }
  } catch {
    //No saved test team
  }
  return [252, 255, 258].map((id) => ({ species: id, level }));
}

/** A stand-in creature to read stats and type matchups of a team member */
function sample({ species: id, level, nature }: Member): Creature {
  return { species: id, level, nature, exp: 0, hp: 0, moves: [], shiny: false };
}

/** Section title, with an optional note on the right */
function Heading({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">
      {children}
      {hint ? <span className="font-normal normal-case tracking-normal">{hint}</span> : null}
    </p>
  );
}

function Designer({ index, close }: { index: number; close: () => void }) {
  const editor = useEditor();
  const npc = editor.city.npcs[index] as Npc | undefined;
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState("team");
  if (!npc?.trainer) {
    return null;
  }
  const data = npc.trainer;
  const update = (fn: () => void) => editor.mutate(fn);
  const current = Math.min(selected, data.team.length - 1);
  const member = data.team[current];
  const move = (from: number, to: number) => {
    if (to < 0 || to >= data.team.length) return;
    update(() => ([data.team[from], data.team[to]] = [data.team[to], data.team[from]]));
    setSelected(to);
  };
  const add = () => {
    update(() => data.team.push({ species: 1 + Math.floor(Math.random() * assets.pokedex.length), level: data.team.at(-1)?.level ?? 5 }));
    setSelected(data.team.length - 1);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex h-[min(90vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
          <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 pr-12">
            {npc.sprite ? (
              <CanvasView className="h-10 w-9 shrink-0" make={() => preview(texture(npc.sprite, "down"), 2 * scaleOf(npc.sprite))} deps={[npc.sprite]} />
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{npc.name || "Trainer"}&apos;s battle</DialogTitle>
              <DialogDescription className="truncate text-xs">
                {data.gym ? `Gym Leader · ${data.badge || "badge"}` : "Trainer"} · {data.team.length} Pokémon · up to Lv{" "}
                {Math.max(...data.team.map(({ level }) => level))}
              </DialogDescription>
            </div>
            <TabsList>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="battle">Lines and rules</TabsTrigger>
            </TabsList>
          </header>

          <TabsContent value="team" className="m-0 min-h-0 flex-1 overflow-y-auto md:overflow-hidden">
            <div className="grid min-h-0 md:h-full md:grid-cols-[250px_minmax(0,1fr)]">
              <Roster team={data.team} current={current} onSelect={setSelected} onMove={move} onAdd={data.team.length < 6 ? add : undefined} />
              <div className="min-h-0 p-5 md:overflow-y-auto">
                {member ? (
                  <MemberEditor
                    key={current}
                    member={member}
                    update={update}
                    onRemove={
                      data.team.length > 1
                        ? () => {
                            update(() => data.team.splice(current, 1));
                            setSelected(Math.max(0, current - 1));
                          }
                        : undefined
                    }
                  />
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="battle" className="m-0 min-h-0 flex-1 overflow-y-auto p-5">
            <BattleSettings npc={npc} update={update} />
          </TabsContent>
        </Tabs>
        <TestBar index={index} npc={npc} close={close} />
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Team

/** Types a team is weak to, by how many of its Pokémon take double damage */
function weaknesses(team: Member[]) {
  return Object.keys(assets.types)
    .map((type) => ({ type, count: team.filter((member) => species(member.species) && effectiveness(type, sample(member)) > 1).length }))
    .filter(({ count }) => count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** The team in battle order: pick one to edit, reorder, add */
function Roster({
  team,
  current,
  onSelect,
  onMove,
  onAdd,
}: {
  team: Member[];
  current: number;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd?: () => void;
}) {
  const weak = weaknesses(team);
  return (
    <aside className="flex min-h-0 flex-col gap-3 border-b border-border bg-muted/30 p-3 md:border-b-0 md:border-r">
      <Heading hint="sent out in order">Team {team.length}/6</Heading>
      <ol className="grid gap-1 md:overflow-y-auto">
        {team.map((member, i) => {
          const known = species(member.species);
          return (
            <li key={i}>
              <div
                role="button"
                tabIndex={0}
                aria-current={i === current}
                onClick={() => onSelect(i)}
                onKeyDown={(event) => ["Enter", " "].includes(event.key) && (event.preventDefault(), onSelect(i))}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-left",
                  i === current ? "border-select bg-card" : "border-transparent hover:bg-card",
                )}
              >
                <span className="w-3 text-center font-mono text-[10px] text-subtle-fg">{i + 1}</span>
                <CanvasView className="h-[30px] w-[34px] shrink-0 overflow-hidden" make={() => portrait(member.species, 1)} deps={[member.species]} />
                <span className="grid min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-medium">
                    {member.nickname || known?.name || "?"}
                    {member.shiny ? <Sparkle size={11} weight="fill" className="shrink-0 text-select" /> : null}
                  </span>
                  <span className="flex min-w-0 items-center gap-1 text-[11px] text-subtle-fg">
                    Lv {member.level}
                    {known?.types.map((type) => (
                      <span key={type} className="size-2 shrink-0 rounded-full" style={{ background: colors[type] }} title={type} />
                    ))}
                    {member.held ? <span className="truncate">· {items[member.held].name}</span> : null}
                  </span>
                </span>
                <span className="flex flex-col opacity-0 group-hover:opacity-100 group-aria-[current=true]:opacity-100 pointer-coarse:opacity-100">
                  <button
                    aria-label="Send out earlier"
                    disabled={!i}
                    onClick={(event) => (event.stopPropagation(), onMove(i, i - 1))}
                    className="grid size-4 place-items-center rounded text-subtle-fg hover:text-foreground disabled:opacity-20"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    aria-label="Send out later"
                    disabled={i === team.length - 1}
                    onClick={(event) => (event.stopPropagation(), onMove(i, i + 1))}
                    className="grid size-4 place-items-center rounded text-subtle-fg hover:text-foreground disabled:opacity-20"
                  >
                    <ArrowDown size={11} />
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {onAdd ? (
        <button
          onClick={onAdd}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-ring hover:text-foreground"
        >
          <Plus size={14} />
          Add Pokémon
        </button>
      ) : null}
      {weak.length ? (
        <div className="mt-auto grid gap-1.5 rounded-lg border border-border bg-card p-2">
          <p className="text-[11px] text-subtle-fg">Several of them are weak to</p>
          <div className="flex flex-wrap gap-1.5">
            {weak.map(({ type, count }) => (
              <span key={type} className="flex items-center gap-1">
                <TypeBadge type={type} />
                <span className="text-[10px] text-subtle-fg">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

/** What a move does besides damage, in a few words */
function effectOf(move: Move) {
  const effect = move.effect;
  if (!effect) return move.priority > 0 ? "Usually goes first" : "";
  const names = { attack: "Attack", defense: "Defense", spatk: "Sp. Atk", spdef: "Sp. Def", speed: "Speed", accuracy: "accuracy", evasion: "evasion" };
  const parts = [] as string[];
  if (effect.ailment) parts.push({ sleep: "Puts to sleep", poison: "Poisons", paralysis: "Paralyzes", burn: "Burns" }[effect.ailment]);
  for (const [stage, change] of effect.stats ?? []) {
    parts.push(`${change > 0 ? "+" : "−"}${Math.abs(change)} ${names[stage]}${effect.self ? " (user)" : ""}`);
  }
  const chance = move.power && effect.chance < 100 ? ` (${effect.chance}%)` : "";
  return parts.join(", ") + chance;
}

/** One move slot, styled like a battle move button: opens a searchable list of the moves it can learn */
function MoveSlot({ moveKey, learnable, taken, onPick }: { moveKey?: string; learnable: [string, number][]; taken: string[]; onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const move = moveKey ? assets.moves[moveKey] : null;
  const color = move ? colors[move.type] : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "grid min-h-[4.5rem] content-center gap-1 rounded-lg border px-3 py-2 text-left transition-[filter]",
            move ? "border-transparent hover:brightness-125" : "border-dashed border-border text-muted-foreground hover:border-ring hover:text-foreground",
          )}
          style={move ? { background: `color-mix(in srgb, ${color} 18%, var(--card))`, boxShadow: `inset 3px 0 0 ${color}` } : undefined}
        >
          {move ? (
            <>
              <span className="flex items-center justify-between gap-2">
                <b className="truncate text-sm">{move.name}</b>
                <TypeBadge type={move.type} />
              </span>
              <span className="flex flex-wrap gap-x-2.5 text-[11px] text-muted-foreground">
                <span className="capitalize">{move.class}</span>
                {move.power ? <span>Power {move.power}</span> : null}
                <span>Acc {move.accuracy}</span>
                <span>PP {move.pp}</span>
              </span>
              {effectOf(move) ? <span className="truncate text-[11px] text-subtle-fg">{effectOf(move)}</span> : null}
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-xs">
              <Plus size={13} />
              Choose a move
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or type…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No move found.</CommandEmpty>
            {moveKey ? (
              <CommandGroup>
                <CommandItem value="remove this move" onSelect={() => (onPick("none"), setOpen(false))} className="text-destructive">
                  <X />
                  Remove this move
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Moves it learns by leveling up">
              {learnable.map(([key, level]) => {
                const data = assets.moves[key];
                return (
                  <CommandItem
                    key={key}
                    value={`${data.name} ${data.type} ${data.class}`}
                    disabled={taken.includes(key) && key !== moveKey}
                    onSelect={() => (onPick(key), setOpen(false))}
                    className="gap-2"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: colors[data.type] }} />
                    <span className="flex-1 truncate">{data.name}</span>
                    <span className="font-mono text-[10px] text-subtle-fg">
                      {data.power || "—"} · Lv {level}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The species' sprite, big (its box icon shows until the sprite has loaded) */
function Sprite({ id, shiny }: { id: number; shiny: boolean }) {
  const src = artwork(id, { shiny });
  const [loaded, setLoaded] = useState("");
  return (
    <div className="relative grid size-28 shrink-0 place-items-center rounded-xl bg-[radial-gradient(ellipse_at_50%_85%,var(--color-muted)_0_40%,transparent_72%)]">
      {loaded !== src ? <CanvasView make={() => portrait(id, 1.6)} deps={[id]} /> : null}
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(src)}
        className={cn("pixelated absolute size-28 object-contain transition-opacity", loaded === src ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

/** Everything about one team member */
function MemberEditor({ member, update, onRemove }: { member: Member; update: (fn: () => void) => void; onRemove?: () => void }) {
  const known = species(member.species);
  //Moves it can learn by leveling up, in level order (the first time each is learned)
  const learnable = [...new Map((known?.learnset ?? []).map(([level, key]) => [key, level])).entries()].filter(([key]) => key in assets.moves);
  const automatic = known ? learned(member.species, member.level) : [];
  const shown = member.moves ?? automatic;
  const set = (patch: Partial<Member>) =>
    update(() => {
      Object.assign(member, patch);
      for (const key of ["held", "ability", "nature", "nickname"] as const) {
        if (!member[key]) delete member[key];
      }
      if (!member.shiny) delete member.shiny;
      if (member.moves && !member.moves.length) delete member.moves;
    });
  const setMove = (slot: number, key: string) => {
    //Start from the automatic moves the first time one is chosen
    const next = [...(member.moves ?? automatic)];
    if (key === "none") next.splice(slot, 1);
    else next[slot] = key;
    set({ moves: [...new Set(next.filter(Boolean))].slice(0, 4) });
  };
  const [up, down] = member.nature ? natures[member.nature] : [0, 0];
  const values = known ? statNames.map((_, i) => stat(sample(member), i)) : [];
  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-start gap-4">
        {known ? <Sprite id={member.species} shiny={Boolean(member.shiny)} /> : null}
        <div className="grid min-w-[14rem] flex-1 gap-2">
          <div className="flex items-center gap-2">
            <SpeciesInput
              value={member.species}
              onChange={(id) => update(() => (Object.assign(member, { species: id }), delete member.moves, delete member.ability))}
            />
            <span className="text-xs text-subtle-fg">Lv</span>
            <NumberInput value={member.level} onCommit={(level) => set({ level })} className="w-16" />
          </div>
          <div className="flex items-center gap-2">
            <TextInput
              value={member.nickname ?? ""}
              maxLength={12}
              placeholder={`Nickname (${known?.name ?? "none"})`}
              onCommit={(nickname) => set({ nickname })}
              className="h-8 flex-1"
            />
            <Tip label={member.shiny ? "Shiny" : "Make it shiny"}>
              <Button
                variant={member.shiny ? "secondary" : "ghost"}
                size="icon"
                aria-label="Shiny"
                aria-pressed={Boolean(member.shiny)}
                onClick={() => set({ shiny: !member.shiny })}
                className={cn("size-8", member.shiny && "text-select")}
              >
                <Sparkle weight={member.shiny ? "fill" : "regular"} />
              </Button>
            </Tip>
            {onRemove ? (
              <Tip label="Remove from the team">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove from the team"
                  onClick={onRemove}
                  className="size-8 text-subtle-fg hover:text-destructive"
                >
                  <Trash />
                </Button>
              </Tip>
            ) : null}
          </div>
          <div className="flex gap-1">
            {known?.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
        </div>
        {known ? (
          <div className="grid w-full gap-1 sm:w-56" aria-label="Stats at this level">
            {statNames.map((name, i) => {
              const boosted = i === up && up !== down,
                lowered = i === down && up !== down;
              return (
                <div key={name} className="grid grid-cols-[3.75rem_2rem_1fr] items-center gap-2 text-[11px]">
                  <span className={cn("text-subtle-fg", boosted && "font-semibold text-emerald-400", lowered && "font-semibold text-red-400")}>
                    {name}
                    {boosted ? " ↑" : lowered ? " ↓" : ""}
                  </span>
                  <span className="text-right font-mono tabular-nums">{values[i]}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (known.stats[i] / 160) * 100)}%`,
                        background: known.stats[i] >= 100 ? "#48d058" : known.stats[i] >= 60 ? "#f8c030" : "#f08030",
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="grid gap-2">
        <Heading
          hint={
            member.moves ? (
              <button onClick={() => set({ moves: [] })} className="text-subtle-fg underline-offset-2 hover:text-foreground hover:underline">
                Back to automatic moves
              </button>
            ) : (
              "automatic: the last ones learned by its level"
            )
          }
        >
          Moves
        </Heading>
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((slot) => (
            <MoveSlot key={slot} moveKey={shown[slot]} learnable={learnable} taken={shown} onPick={(key) => setMove(slot, key)} />
          ))}
        </div>
      </section>

      <section className="grid gap-2">
        <Heading>Ability</Heading>
        <div className="grid gap-2 sm:grid-cols-3">
          {[...(known?.abilities ?? []), "random"].map((key) => {
            const active = (member.ability ?? "random") === key;
            return (
              <button
                key={key}
                role="radio"
                aria-checked={active}
                onClick={() => set({ ability: key === "random" ? undefined : key })}
                className={cn(
                  "grid content-start gap-0.5 rounded-lg border p-2.5 text-left",
                  active ? "border-select bg-select/10" : "border-border bg-card hover:border-ring",
                )}
              >
                <b className="text-sm">{key === "random" ? "Random" : abilityName(key)}</b>
                <span className="line-clamp-2 text-[11px] text-subtle-fg">
                  {key === "random" ? "One of its abilities, picked for each battle" : abilityAbout(key)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <Heading>Nature</Heading>
          <Select value={member.nature ?? "random"} onValueChange={(value) => set({ nature: value === "random" ? undefined : (value as Nature) })}>
            <SelectTrigger className="w-full">
              <SelectValue>{member.nature ? natureLabel(member.nature) : "Random"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Random</SelectItem>
              {natureIds.map((key) => (
                <SelectItem key={key} value={key}>
                  {natureLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-subtle-fg">The stats it raises and lowers light up on the bars above.</p>
        </div>
        <div className="grid content-start gap-2">
          <Heading>Held item</Heading>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Held item">
            {(["none", ...holdable] as const).map((key) => {
              const active = (member.held ?? "none") === key;
              return (
                <button
                  key={key}
                  role="radio"
                  aria-checked={active}
                  title={key === "none" ? "No item" : items[key].about}
                  onClick={() => set({ held: key === "none" ? undefined : (key as ItemId) })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    active ? "border-select bg-select/15 text-foreground" : "border-border text-muted-foreground hover:border-ring hover:text-foreground",
                  )}
                >
                  {key === "none" ? "None" : items[key].name}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-subtle-fg">{member.held ? items[member.held].about : "Hover an item to see what it does."}</p>
        </div>
      </section>
    </div>
  );
}

//=================================================================================================
// Lines and rules

/** A line said mid-battle, previewed the way it shows in the battle log */
function Line({
  name,
  label,
  value,
  placeholder,
  onCommit,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useDraft(value);
  return (
    <div className="grid content-start gap-2 rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-medium">{label}</p>
      <Textarea
        rows={3}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => text !== value && onCommit(text)}
      />
      <p className="rounded-md border-2 border-[#4a4e5e] bg-[#f8f8f4] px-3 py-2 font-pixel text-[11px] leading-relaxed text-[#4a4a52]">
        {text.trim() ? `${name}: ${text.trim().split(/\n\s*\n/)[0]}` : `${name} stays quiet.`}
      </p>
    </div>
  );
}

/** Pick one option among a few, as buttons */
function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode; hint?: string }[];
  onChange: (value: T) => void;
}) {
  const active = options.find((option) => option.value === value);
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {options.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm",
              value === option.value
                ? "border-select bg-select/15 text-foreground"
                : "border-border text-muted-foreground hover:border-ring hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
      {active?.hint ? <p className="text-xs text-subtle-fg">{active.hint}</p> : null}
    </div>
  );
}

function BattleSettings({ npc, update }: { npc: Npc; update: (fn: () => void) => void }) {
  const data = npc.trainer!;
  const rules = data.rules ?? {};
  const name = npc.name || "Trainer";
  const setRule = <K extends keyof BattleRules>(key: K, value: BattleRules[K] | undefined) =>
    update(() => {
      const next = { ...data.rules, [key]: value };
      if (value === undefined || value === false) delete next[key];
      if (Object.keys(next).length) data.rules = next;
      else delete data.rules;
    });
  const setLine = (key: "last" | "low", text: string) =>
    update(() => {
      const next = { ...data.lines, [key]: text.trim() };
      if (!next[key]) delete next[key];
      if (Object.keys(next).length) data.lines = next;
      else delete data.lines;
    });
  return (
    <div className="grid gap-7">
      <section className="grid gap-3">
        <Heading hint="they slide in and say it, once per battle">Mid-battle lines</Heading>
        <div className="grid gap-3 md:grid-cols-2">
          <Line
            name={name}
            label="Sending out their last Pokémon"
            value={data.lines?.last ?? ""}
            placeholder="You've pushed me this far…"
            onCommit={(text) => setLine("last", text)}
          />
          <Line
            name={name}
            label="Their last Pokémon is low on HP"
            value={data.lines?.low ?? ""}
            placeholder="Hang in there!"
            onCommit={(text) => setLine("low", text)}
          />
        </div>
      </section>

      <section className="grid gap-3">
        <Heading>Battle style</Heading>
        <Choice
          value={rules.double ? "double" : "single"}
          onChange={(value) => setRule("double", value === "double" || undefined)}
          options={[
            { value: "single", label: "Single battle", hint: "One Pokémon on each side." },
            {
              value: "double",
              label: "Double battle",
              hint:
                data.team.length < 2
                  ? "Two on each side: give them at least two Pokémon. Players with only one Pokémon able to fight get a single battle."
                  : "Two on each side, like gym leaders Tate and Liza. Players with only one Pokémon able to fight get a single battle.",
            },
          ]}
        />
      </section>

      <section className="grid gap-3">
        <Heading>How they battle</Heading>
        <Choice
          value={rules.difficulty ?? "town"}
          onChange={(value) => setRule("difficulty", value === "town" ? undefined : (value as BattleRules["difficulty"]))}
          options={[
            { value: "town", label: "Town's difficulty", hint: "Whatever City settings say for every trainer." },
            { value: "easy", label: "Easy", hint: "Picks moves at random." },
            { value: "normal", label: "Normal", hint: "Favors strong, effective moves of their own type." },
            { value: "hard", label: "Hard", hint: "Always uses the move that hurts most, never one you're immune to." },
          ]}
        />
      </section>

      <section className="grid gap-3">
        <Heading>Weather</Heading>
        <Choice
          value={rules.weather ?? "map"}
          onChange={(value) => setRule("weather", value === "map" ? undefined : (value as BattleRules["weather"]))}
          options={[
            { value: "map", label: "The map's", icon: <MapTrifold size={15} />, hint: "Whatever the weather is on the map where they stand." },
            { value: "clear", label: "Clear", icon: <Sun size={15} />, hint: "No weather, even if it rains on the map." },
            { value: "rain", label: "Rain", icon: <CloudRain size={15} />, hint: "Water moves ×1.5, Fire moves ×0.5, Swift Swim doubles Speed." },
            { value: "sandstorm", label: "Sandstorm", icon: <Wind size={15} />, hint: "Hurts every Pokémon but Rock, Ground and Steel types each turn." },
            { value: "snow", label: "Snow", icon: <Snowflake size={15} />, hint: "Hurts every Pokémon but Ice types each turn." },
          ]}
        />
      </section>

      <section className="grid gap-3">
        <Heading>Scene</Heading>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <button
            onClick={() => setRule("scene", undefined)}
            className={cn(
              "grid gap-1 rounded-lg border p-1.5 text-xs",
              !rules.scene ? "border-select bg-select/10 text-foreground" : "border-border text-muted-foreground hover:border-ring",
            )}
          >
            <span className="grid aspect-[240/112] w-full place-items-center rounded-sm bg-muted">
              <MapTrifold size={18} />
            </span>
            The map&apos;s
          </button>
          {scenes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRule("scene", key)}
              className={cn(
                "grid gap-1 rounded-lg border p-1.5 text-xs",
                rules.scene === key ? "border-select bg-select/10 text-foreground" : "border-border text-muted-foreground hover:border-ring",
              )}
            >
              <img src={scenePicture(key)} alt="" className="pixelated aspect-[240/112] w-full rounded-sm object-cover" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <Heading>Bag</Heading>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3">
          <Prohibit size={18} className="text-muted-foreground" />
          <span className="grid flex-1">
            <b className="text-sm">No items</b>
            <span className="text-xs text-subtle-fg">The player can&apos;t use Potions or other items in this battle.</span>
          </span>
          <Switch checked={Boolean(rules.noItems)} onCheckedChange={(on) => setRule("noItems", on || undefined)} />
        </label>
      </section>
    </div>
  );
}

//=================================================================================================
// Test battle

/** Always at the bottom: who to test with, and the button */
function TestBar({ index, npc, close }: { index: number; npc: Npc; close: () => void }) {
  const top = Math.max(5, ...npc.trainer!.team.map(({ level }) => level));
  const mine = Boolean(trainer.profile?.party.length);
  const [party, setParty] = useState<"mine" | "test">(mine ? "mine" : "test");
  const [team, setTeam] = useState<Tester[]>(() => testers(top));
  const [busy, setBusy] = useState(false);
  const saveTeam = (next: Tester[]) => {
    setTeam(next);
    try {
      localStorage.setItem("dreammist.test-team", JSON.stringify(next));
    } catch {
      //Storage unavailable: the test team lasts until the dialog closes
    }
  };
  const test = async () => {
    const creatures =
      party === "mine" && trainer.profile?.party.length
        ? trainer.profile.party.map((creature) => {
            //A copy, healed: the real party isn't touched
            const copy = structuredClone(creature);
            heal(copy);
            return copy;
          })
        : team.filter(({ species: id }) => species(id)).map(({ species: id, level }) => create(id, level, { shiny: false }));
    setBusy(true);
    close();
    try {
      const outcome = await session.testBattle(npc, creatures);
      toast.info(outcome === "win" ? "You won the test battle" : outcome === "lose" ? "You lost the test battle" : "Test battle over");
    } catch (error) {
      toast.error(message(error));
    }
    void battleDesigner(index);
  };
  const icons = party === "mine" ? (trainer.profile?.party ?? []).map(({ species: id }) => id) : team.map(({ species: id }) => id);
  return (
    <footer className="flex flex-wrap items-center gap-3 border-t border-border bg-card px-5 py-3">
      <span className="text-sm font-medium">Test with</span>
      <Select value={party} onValueChange={(value) => setParty(value as "mine" | "test")}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mine ? <SelectItem value="mine">Your party in Play</SelectItem> : null}
          <SelectItem value="test">A test team</SelectItem>
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger asChild disabled={party === "mine"}>
          <button
            className="flex items-center gap-0.5 rounded-lg border border-border px-1.5 py-0.5 enabled:hover:border-ring disabled:border-transparent"
            title={party === "mine" ? "A healed copy of your party" : "Change the test team"}
          >
            {icons.map((id, i) => (
              <CanvasView key={`${id}-${i}`} className="h-[30px] w-[34px] overflow-hidden" make={() => portrait(id, 1)} deps={[id]} />
            ))}
          </button>
        </PopoverTrigger>
        <PopoverContent className="grid w-80 gap-1.5" align="start">
          <p className="text-xs font-medium">Test team</p>
          {team.map((member, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <SpeciesInput value={member.species} onChange={(id) => saveTeam(team.map((other, j) => (j === i ? { ...other, species: id } : other)))} />
              <span className="text-xs text-subtle-fg">Lv</span>
              <NumberInput
                value={member.level}
                onCommit={(level) => saveTeam(team.map((other, j) => (j === i ? { ...other, level } : other)))}
                className="w-14"
              />
              <button
                aria-label="Remove from the test team"
                disabled={team.length <= 1}
                onClick={() => saveTeam(team.filter((_, j) => j !== i))}
                className="grid size-7 shrink-0 place-items-center rounded text-subtle-fg hover:text-destructive disabled:opacity-30"
              >
                <Trash size={13} />
              </button>
            </div>
          ))}
          {team.length < 6 ? (
            <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => saveTeam([...team, { species: 25, level: top }])}>
              <Plus />
              Add Pokémon
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
      <span className="hidden flex-1 text-xs text-subtle-fg lg:block">Nothing is saved: your party, items and progress stay as they are.</span>
      <Button onClick={test} disabled={busy} className="ml-auto">
        <Play weight="fill" />
        Test battle
      </Button>
    </footer>
  );
}
