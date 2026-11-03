"use client";

import { openDialog } from "@/components/editor/dialogs";
import { useEditor } from "@/components/editor/hooks";
import { SpeciesInput } from "@/components/editor/pokemon-picker";
import { CanvasView, Field, Hint, NumberInput, TextInput, Tip, useDraft } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { abilityAbout, abilityName } from "@/game/abilities";
import { assets, npc as texture, preview, species } from "@/game/assets";
import { colors } from "@/game/battle";
import { type BattleRules, battleWeathers, type Member, type Npc, scenePicture, scenes } from "@/game/data";
import { holdable, type ItemId, items } from "@/game/items";
import { type Nature, natureIds, natureLabel } from "@/game/natures";
import { message, session } from "@/game/session";
import { scaleOf } from "@/game/sprites";
import { create, heal, learned, trainer } from "@/game/trainer";
import { Play, Plus, Sparkle, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

/** Open the battle designer of a trainer (by their index on the open map) */
export function battleDesigner(index: number) {
  return openDialog<void>((close) => <Designer index={index} close={close} />);
}

/** A test party member (kept in this browser between tests) */
type Tester = { species: number; level: number };

/** Party used for test battles: the trainer's own party in Play, or a test team */
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

function Designer({ index, close }: { index: number; close: () => void }) {
  const editor = useEditor();
  const npc = editor.city.npcs[index] as Npc | undefined;
  const top = Math.max(5, ...(npc?.trainer?.team.map(({ level }) => level) ?? []));
  const [party, setParty] = useState<"mine" | "test">(trainer.profile?.party.length ? "mine" : "test");
  const [team, setTeam] = useState<Tester[]>(() => testers(top));
  const [busy, setBusy] = useState(false);
  if (!npc?.trainer) {
    return null;
  }
  const data = npc.trainer;
  const update = (fn: () => void) => editor.mutate(fn);
  const rules = data.rules ?? {};
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
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {npc.sprite ? (
              <CanvasView className="h-8 w-8" make={() => preview(texture(npc.sprite, "down"), 1.5 * scaleOf(npc.sprite))} deps={[npc.sprite]} />
            ) : null}
            Battle designer: {npc.name || "Trainer"}
          </DialogTitle>
          <DialogDescription>
            Choose each Pokémon&apos;s moves, ability, nature and item, what they say mid-battle, and the rules of the battle.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Team ({data.team.length}/6)</p>
          <div className="grid gap-2 md:grid-cols-2">
            {data.team.map((member, i) => (
              <MemberCard key={i} member={member} update={update} onRemove={data.team.length > 1 ? () => update(() => data.team.splice(i, 1)) : undefined} />
            ))}
            {data.team.length < 6 ? (
              <button
                onClick={() =>
                  update(() => data.team.push({ species: 1 + Math.floor(Math.random() * assets.pokedex.length), level: data.team.at(-1)?.level ?? 5 }))
                }
                className="grid min-h-24 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-ring hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Plus size={14} />
                  Add Pokémon
                </span>
              </button>
            ) : null}
          </div>
        </section>

        <section className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Mid-battle lines</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Line
              label="Sending out their last Pokémon"
              value={data.lines?.last ?? ""}
              placeholder="You've pushed me this far…"
              onCommit={(text) => setLine("last", text)}
            />
            <Line
              label="Their last Pokémon is low on HP"
              value={data.lines?.low ?? ""}
              placeholder="Hang in there!"
              onCommit={(text) => setLine("low", text)}
            />
          </div>
          <Hint>They slide in and say it once per battle. Leave empty to stay quiet.</Hint>
        </section>

        <section className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Battle rules</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Field label="Trainer">
              <Select
                value={rules.difficulty ?? "town"}
                onValueChange={(value) => setRule("difficulty", value === "town" ? undefined : (value as BattleRules["difficulty"]))}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="town">Town&apos;s difficulty</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Weather">
              <Select
                value={rules.weather ?? "map"}
                onValueChange={(value) => setRule("weather", value === "map" ? undefined : (value as BattleRules["weather"]))}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="map">The map&apos;s</SelectItem>
                  {battleWeathers.map((weather) => (
                    <SelectItem key={weather} value={weather}>
                      {weather[0].toUpperCase() + weather.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Scene">
              <Select value={rules.scene ?? "map"} onValueChange={(value) => setRule("scene", value === "map" ? undefined : (value as BattleRules["scene"]))}>
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="map">The map&apos;s</SelectItem>
                  {scenes.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bag">
              <Label className="flex h-8 items-center justify-between gap-2 rounded-md border border-border px-2 text-xs font-normal text-muted-foreground">
                No items
                <Switch checked={Boolean(rules.noItems)} onCheckedChange={(on) => setRule("noItems", on || undefined)} />
              </Label>
            </Field>
          </div>
          {rules.scene ? (
            <img src={scenePicture(rules.scene)} alt="" className="pixelated aspect-[240/112] w-48 rounded-sm border border-border object-cover" />
          ) : null}
        </section>

        <section className="grid gap-2 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm font-semibold">Test battle</p>
            <Select value={party} onValueChange={(value) => setParty(value as "mine" | "test")}>
              <SelectTrigger className="h-8 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trainer.profile?.party.length ? <SelectItem value="mine">With your party in Play</SelectItem> : null}
                <SelectItem value="test">With a test team</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={test} disabled={busy}>
              <Play />
              Test battle
            </Button>
          </div>
          {party === "test" ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-muted-foreground"
                  onClick={() => saveTeam([...team, { species: 25, level: top }])}
                >
                  <Plus />
                  Add Pokémon
                </Button>
              ) : null}
            </div>
          ) : (
            <Hint>A healed copy of your party is used.</Hint>
          )}
          <Hint>Nothing is saved: your party, items and progress stay as they are.</Hint>
        </section>
      </DialogContent>
    </Dialog>
  );
}

/** A line said mid-battle (saves when leaving the field) */
function Line({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder: string; onCommit: (text: string) => void }) {
  const [text, setText] = useDraft(value);
  return (
    <Field label={label}>
      <Textarea
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => text !== value && onCommit(text)}
      />
    </Field>
  );
}

/** One Pokémon of the team, with everything that can be chosen for it */
function MemberCard({ member, update, onRemove }: { member: Member; update: (fn: () => void) => void; onRemove?: () => void }) {
  const known = species(member.species);
  //Moves it can learn by leveling up, in level order (the first time each is learned)
  const learnable = [...new Map((known?.learnset ?? []).map(([level, key]) => [key, level])).entries()].filter(([key]) => key in assets.moves);
  const automatic = known ? learned(member.species, member.level) : [];
  const moves = member.moves ?? [];
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
  const shown = member.moves ? moves : automatic;
  return (
    <div className="grid content-start gap-2 rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-1.5">
        <SpeciesInput
          value={member.species}
          onChange={(id) => update(() => (Object.assign(member, { species: id }), delete member.moves, delete member.ability))}
        />
        <span className="text-xs text-subtle-fg">Lv</span>
        <NumberInput value={member.level} onCommit={(level) => set({ level })} className="w-14" />
        {onRemove ? (
          <Tip label="Remove from the team">
            <button
              aria-label="Remove from the team"
              onClick={onRemove}
              className="grid size-7 shrink-0 place-items-center rounded text-subtle-fg hover:text-destructive"
            >
              <Trash size={14} />
            </button>
          </Tip>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <TextInput
          value={member.nickname ?? ""}
          maxLength={12}
          placeholder={known?.name ?? "Nickname"}
          onCommit={(nickname) => set({ nickname })}
          className="h-8 flex-1"
        />
        <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground" title="Shiny colors">
          <Checkbox checked={Boolean(member.shiny)} onCheckedChange={(on) => set({ shiny: on === true })} />
          <Sparkle size={13} />
        </Label>
      </div>
      <Field label={member.moves ? "Moves" : "Moves (automatic: the last ones learned by its level)"}>
        <div className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((slot) => {
            const key = shown[slot];
            return (
              <Select key={slot} value={key ?? "none"} onValueChange={(value) => setMove(slot, value)}>
                <SelectTrigger
                  className="h-8 w-full px-2 text-xs"
                  style={key ? { borderLeft: `3px solid ${colors[assets.moves[key]?.type] ?? "transparent"}` } : undefined}
                >
                  <SelectValue placeholder="—">{key ? (assets.moves[key]?.name ?? key) : "— No move"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No move</SelectItem>
                  {learnable.map(([move, level]) => (
                    <SelectItem key={move} value={move} disabled={shown.includes(move) && move !== key}>
                      {assets.moves[move].name}
                      <span className="ml-auto pl-3 text-[10px] text-subtle-fg">
                        {assets.moves[move].type} · {assets.moves[move].power || "status"} · Lv {level}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
        </div>
        {member.moves ? (
          <button onClick={() => set({ moves: [] })} className="w-fit text-[11px] text-subtle-fg hover:text-foreground">
            Back to automatic moves
          </button>
        ) : null}
      </Field>
      <div className="grid grid-cols-3 gap-1">
        <Field label="Ability">
          <Select value={member.ability ?? "random"} onValueChange={(value) => set({ ability: value === "random" ? undefined : value })}>
            <SelectTrigger className="h-8 w-full px-2 text-xs" title={abilityAbout(member.ability)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Random</SelectItem>
              {(known?.abilities ?? []).map((key) => (
                <SelectItem key={key} value={key} title={abilityAbout(key)}>
                  {abilityName(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nature">
          <Select value={member.nature ?? "random"} onValueChange={(value) => set({ nature: value === "random" ? undefined : (value as Nature) })}>
            <SelectTrigger className="h-8 w-full px-2 text-xs">
              <SelectValue>{member.nature ? member.nature[0].toUpperCase() + member.nature.slice(1) : "Random"}</SelectValue>
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
        </Field>
        <Field label="Item">
          <Select value={member.held ?? "none"} onValueChange={(value) => set({ held: value === "none" ? undefined : (value as ItemId) })}>
            <SelectTrigger className="h-8 w-full px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {holdable.map((key) => (
                <SelectItem key={key} value={key}>
                  {items[key].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}
