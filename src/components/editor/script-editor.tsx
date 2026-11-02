"use client";

import { SpeciesInput } from "@/components/editor/pokemon-picker";
import { NumberInput, Tip, useDraft } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { species } from "@/game/assets";
import type { Action, ActionKind, Direction, Npc, Who } from "@/game/data";
import type { EditorEngine } from "@/game/editor/engine";
import { type ItemId, itemIds, items } from "@/game/items";
import { arrows, kinds } from "@/game/scripts";
import { lanes } from "@/game/story";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Backspace, Plus, X } from "@phosphor-icons/react";

/** Name of someone in a list of people */
function named(npc: Npc) {
  if (npc.role === "item") {
    return "Item";
  }
  return npc.name || (npc.creature ? species(npc.creature.species)?.name : npc.sprite ? "Someone" : "Sign") || "Someone";
}

/** Pick a story step (grouped by main story and side quests) */
export function StepSelect({ editor, value, empty, onChange }: { editor: EditorEngine; value?: string; empty: string; onChange: (id: string) => void }) {
  return (
    <Select value={value || "none"} onValueChange={(next) => onChange(next === "none" ? "" : next)}>
      <SelectTrigger className="h-8 min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{empty}</SelectItem>
        {lanes(editor.world)
          .filter(({ steps }) => steps.length)
          .map(({ quest, steps }) => (
            <SelectGroup key={quest?.id ?? "main"}>
              <SelectLabel>{quest?.name ?? "Main story"}</SelectLabel>
              {steps.map((step, i) => (
                <SelectItem key={step.id} value={step.id}>
                  {i + 1}. {step.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </Select>
  );
}

/** Pick someone of the map (or the player, or nobody) */
function WhoSelect({
  editor,
  value,
  player,
  nobody,
  filter = () => true,
  onChange,
}: {
  editor: EditorEngine;
  value: Who | undefined;
  player?: boolean;
  nobody?: string;
  filter?: (npc: Npc) => boolean;
  onChange: (who: Who | undefined) => void;
}) {
  const people = editor.city.npcs.map((npc, index) => ({ npc, index })).filter(({ npc }) => npc.role !== "item" && filter(npc));
  const current = value === undefined ? "none" : `${value}`;
  return (
    <Select value={current} onValueChange={(next) => onChange(next === "none" ? undefined : next === "player" ? "player" : Number(next))}>
      <SelectTrigger className="h-8 min-w-0 flex-1">
        <SelectValue placeholder="Who…" />
      </SelectTrigger>
      <SelectContent>
        {nobody ? <SelectItem value="none">{nobody}</SelectItem> : null}
        {player ? <SelectItem value="player">The player</SelectItem> : null}
        {people.map(({ npc, index }) => (
          <SelectItem key={index} value={`${index}`}>
            {named(npc)} ({npc.x}, {npc.y})
          </SelectItem>
        ))}
        {typeof value === "number" && !people.some(({ index }) => index === value) ? (
          <SelectItem value={`${value}`} disabled>
            Someone missing
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}

/** Message of a "say" action (saves when leaving the field) */
function Message({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const [text, setText] = useDraft(value);
  return (
    <Textarea
      rows={2}
      value={text}
      placeholder="What they say…"
      onChange={(event) => setText(event.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      className="min-h-14 text-sm"
    />
  );
}

/** Steps walked by a "move" action: arrow buttons add one, backspace removes the last */
function Steps({ steps, onChange }: { steps: Direction[]; onChange: (steps: Direction[]) => void }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex min-h-8 flex-wrap items-center gap-0.5 rounded-md border border-border bg-input/30 px-2 py-1 font-mono text-sm">
        {steps.length ? steps.map((dir, i) => <span key={i}>{arrows[dir]}</span>) : <span className="text-xs text-subtle-fg">No steps yet</span>}
      </div>
      <div className="flex items-center gap-1">
        {(["up", "down", "left", "right"] as const).map((dir) => (
          <Button key={dir} variant="outline" size="sm" className="h-7 w-8 px-0 font-mono" aria-label={`Step ${dir}`} onClick={() => onChange([...steps, dir])}>
            {arrows[dir]}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-8 px-0"
          aria-label="Remove the last step"
          disabled={!steps.length}
          onClick={() => onChange(steps.slice(0, -1))}
        >
          <Backspace />
        </Button>
      </div>
    </div>
  );
}

/** Fields of one action */
function Fields({ editor, action, set }: { editor: EditorEngine; action: Action; set: (patch: Partial<Action>) => void }) {
  const dir = (value: Direction, onChange: (dir: Direction) => void) => (
    <Select value={value} onValueChange={(next) => onChange(next as Direction)}>
      <SelectTrigger className="h-8 w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(["up", "down", "left", "right"] as const).map((key) => (
          <SelectItem key={key} value={key}>
            {arrows[key]} {key[0].toUpperCase() + key.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  switch (action.do) {
    case "say":
      return (
        <>
          <WhoSelect editor={editor} value={action.who} nobody="Nobody (narration)" onChange={(who) => set({ who: who as number | undefined })} />
          <Message value={action.text} onCommit={(text) => set({ text })} />
        </>
      );
    case "move":
      return (
        <>
          <WhoSelect
            editor={editor}
            value={action.who}
            player
            filter={(npc) => Boolean(npc.sprite || npc.creature)}
            onChange={(who) => set({ who: who ?? "player" })}
          />
          <Steps steps={action.steps} onChange={(steps) => set({ steps })} />
        </>
      );
    case "face":
      return (
        <div className="flex items-center gap-1.5">
          <WhoSelect
            editor={editor}
            value={action.who}
            player
            filter={(npc) => Boolean(npc.sprite || npc.creature)}
            onChange={(who) => set({ who: who ?? "player" })}
          />
          {dir(action.dir, (value) => set({ dir: value }))}
        </div>
      );
    case "come":
    case "back":
      return (
        <WhoSelect
          editor={editor}
          value={action.who}
          filter={(npc) => Boolean(npc.sprite || npc.creature)}
          onChange={(who) => set({ who: (who ?? 0) as number })}
        />
      );
    case "battle":
      return (
        <WhoSelect
          editor={editor}
          value={action.who}
          filter={(npc) => (npc.role === "trainer" && Boolean(npc.trainer?.team.length)) || npc.role === "wild"}
          onChange={(who) => set({ who: (who ?? 0) as number })}
        />
      );
    case "wait":
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <NumberInput min={0} max={10} value={action.seconds} onCommit={(seconds) => set({ seconds })} className="w-16" />
          seconds
        </div>
      );
    case "give":
      return (
        <div className="flex items-center gap-1.5">
          <Select value={action.item} onValueChange={(item) => set({ item: item as ItemId })}>
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itemIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {items[id].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-subtle-fg">×</span>
          <NumberInput min={1} max={99} value={action.count} onCommit={(count) => set({ count })} className="w-14" />
        </div>
      );
    case "pokemon":
      return (
        <div className="flex items-center gap-1.5">
          <SpeciesInput value={action.species} onChange={(id) => set({ species: id })} />
          <span className="text-xs text-subtle-fg">Lv</span>
          <NumberInput value={action.level} onCommit={(level) => set({ level })} className="w-14" />
        </div>
      );
    case "money":
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          ₽
          <NumberInput min={0} max={999999} value={action.amount} onCommit={(amount) => set({ amount })} className="w-24" />
        </div>
      );
    case "heal":
      return null;
    case "step":
      return <StepSelect editor={editor} value={action.step} empty="Choose a step…" onChange={(step) => set({ step })} />;
    case "warp": {
      const maps = [{ id: "", name: editor.world.name || "Outside" }, ...editor.world.interiors.map(({ id, name }) => ({ id, name }))];
      return (
        <div className="grid gap-1.5">
          <Select value={action.to || "outside"} onValueChange={(to) => set({ to: to === "outside" ? "" : to })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {maps.map(({ id, name }) => (
                <SelectItem key={id || "outside"} value={id || "outside"}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Tile
            <NumberInput min={0} max={999} value={action.x} onCommit={(x) => set({ x })} className="w-16" />
            <NumberInput min={0} max={999} value={action.y} onCommit={(y) => set({ y })} className="w-16" />
          </div>
        </div>
      );
    }
  }
}

/** Order of actions in the "Add" menu */
const menu: ActionKind[] = ["say", "come", "move", "face", "back", "wait", "battle", "give", "pokemon", "money", "heal", "step", "warp"];

/** Edit a script: its actions in order, each with its own fields */
export function ScriptEditor({
  editor,
  actions,
  update,
  self,
}: {
  editor: EditorEngine;
  actions: Action[];
  update: (fn: () => void) => void;
  /** Whose script it is (they speak and act by default) */
  self?: number;
}) {
  const swap = (a: number, b: number) => update(() => ([actions[a], actions[b]] = [actions[b], actions[a]]));
  //New actions are about the script's owner, or the first person of the map
  const add = (kind: ActionKind) => {
    const action = kinds[kind].make();
    const someone = self ?? editor.city.npcs.findIndex(({ sprite, creature }) => sprite || creature);
    if (action.do === "say" && self !== undefined) {
      action.who = self;
    } else if ("who" in action && typeof action.who === "number") {
      action.who = Math.max(0, someone);
    }
    update(() => actions.push(action));
  };
  return (
    <div className="grid gap-1.5">
      {actions.length ? (
        <ol className="grid gap-1.5">
          {actions.map((action, i) => (
            <li key={i} className="grid gap-1.5 rounded-lg border border-border bg-card p-2">
              <div className="flex items-center gap-1">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                  {i + 1}
                </span>
                <b className="flex-1 truncate text-xs" title={kinds[action.do].hint}>
                  {kinds[action.do].label}
                </b>
                <Tip label="Move up">
                  <button
                    aria-label="Move up"
                    disabled={!i}
                    onClick={() => swap(i, i - 1)}
                    className="grid size-6 place-items-center rounded text-subtle-fg hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp size={12} />
                  </button>
                </Tip>
                <Tip label="Move down">
                  <button
                    aria-label="Move down"
                    disabled={i === actions.length - 1}
                    onClick={() => swap(i, i + 1)}
                    className="grid size-6 place-items-center rounded text-subtle-fg hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown size={12} />
                  </button>
                </Tip>
                <Tip label="Remove">
                  <button
                    aria-label="Remove"
                    onClick={() => update(() => actions.splice(i, 1))}
                    className="grid size-6 place-items-center rounded text-subtle-fg hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                </Tip>
              </div>
              <Fields
                editor={editor}
                action={action}
                set={(patch) =>
                  update(() => {
                    Object.assign(action, patch);
                    //Narration has no speaker
                    if (action.do === "say" && action.who === undefined) {
                      delete action.who;
                    }
                  })
                }
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className={cn("rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-subtle-fg")}>Nothing happens yet. Add an action.</p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-fit">
            <Plus />
            Add action
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {menu.map((kind) => (
            <DropdownMenuItem key={kind} onSelect={() => add(kind)} className="flex-col items-start gap-0">
              <span className="text-sm">{kinds[kind].label}</span>
              <span className="text-[11px] text-subtle-fg">{kinds[kind].hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
