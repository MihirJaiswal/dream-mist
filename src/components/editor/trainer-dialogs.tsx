"use client";

import { confirm } from "@/components/editor/account-dialogs";
import { openDialog } from "@/components/editor/dialogs";
import { useSession } from "@/components/editor/hooks";
import { TypeBadge } from "@/components/editor/pokemon-picker";
import { CanvasView, Field, Hint } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { assets, npc as texture, portrait, preview, species } from "@/game/assets";
import { colors, statusLabels } from "@/game/battle";
import { bestRod, type ItemId, itemCount, items } from "@/game/items";
import { period } from "@/game/atmosphere";
import { living } from "@/game/encounters";
import { outdoors } from "@/game/region";
import type { City } from "@/game/data";
import { cloud } from "@/game/cloud";
import { session } from "@/game/session";
import { type Entry, goal, journal } from "@/game/story";
import { abilityOf, type Creature, hp, named, starters, type Status, trainer } from "@/game/trainer";
import { abilityAbout, abilityName } from "@/game/abilities";
import { natureLabel } from "@/game/natures";
import { cn } from "@/lib/utils";
import { Flag, Medal, Minus, Plus, Scroll, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

//=================================================================================================
// New trainer

export function onboarding() {
  return openDialog<void>((close) => <Onboarding close={close} />).then(() => undefined);
}

function Onboarding({ close }: { close: () => void }) {
  const looks = [
    "may",
    "em_brendan",
    "em_may",
    "wally",
    "youngster",
    "lass",
    "ace_trainer",
    "hiker",
    "psychic",
    "rich_boy",
    "schoolkid_f",
    "schoolkid_m",
    "triathlete_f",
    "triathlete_m",
    "ranger",
    "sailor",
    "twin",
    "aroma",
  ].filter((name) => assets.npcs.includes(name));
  const [name, setName] = useState(cloud.user?.username ?? "");
  const [sprite, setSprite] = useState("may");
  const [starter, setStarter] = useState(starters[0]);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome, new trainer!</DialogTitle>
          <DialogDescription>
            {cloud.user
              ? "Your trainer travels with you through every city. Progress is saved to your account."
              : "Your trainer travels with you through every city. Progress is saved in this browser (log in to keep it online)."}
          </DialogDescription>
        </DialogHeader>
        <Field label="Name">
          <Input autoFocus value={name} placeholder="Your trainer name" maxLength={16} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Looks">
          <div className="flex flex-wrap gap-1">
            {looks.map((look) => (
              <button
                key={look}
                onClick={() => setSprite(look)}
                className={cn(
                  "grid h-14 w-11 place-items-center rounded-md border bg-card",
                  sprite === look ? "border-select" : "border-border hover:border-ring",
                )}
              >
                <CanvasView make={() => preview(texture(look, "down"), 2)} deps={[look]} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Choose your partner">
          <div className="grid grid-cols-3 gap-2">
            {starters.map((id) => (
              <button
                key={id}
                onClick={() => setStarter(id)}
                className={cn(
                  "grid justify-items-center gap-1 rounded-lg border bg-card p-2",
                  starter === id ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-border hover:border-ring",
                )}
                style={{ ["--accent" as string]: colors[species(id).types[0]] }}
              >
                <CanvasView make={() => portrait(id, 2)} deps={[id]} />
                <b className="text-sm">{species(id).name}</b>
                <TypeBadge type={species(id).types[0]} />
              </button>
            ))}
          </div>
        </Field>
        <Button
          onClick={() => {
            session.startTrainer(name, sprite, starter);
            close();
            toast.success(`${species(starter).name} joined your party!`);
          }}
        >
          Start adventure
        </Button>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Party and PC box

export function party() {
  return openDialog<void>((close) => <Party close={close} />);
}

/** Condition badge (SLP, PSN, PAR, BRN) */
export function StatusBadge({ status }: { status: Status }) {
  const { label, color } = statusLabels[status];
  return (
    <span className="rounded px-1.5 font-mono text-[10px] font-bold text-white" style={{ background: color }}>
      {label}
    </span>
  );
}

/** Give a Pokémon an item from the bag to hold in battle, or take it back */
function HoldItem({ creature }: { creature: Creature }) {
  const held = creature.held;
  const options = trainer.bag.filter(({ id }) => items[id].kind === "hold" && id !== held);
  if (!held && !options.length) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          {held ? "Item" : "Give item"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {held ? <DropdownMenuItem onSelect={() => session.hold(creature, null)}>Take the {items[held].name}</DropdownMenuItem> : null}
        {options.map(({ id, count }) => (
          <DropdownMenuItem key={id} onSelect={() => session.hold(creature, id)}>
            {held ? `Swap for ${items[id].name}` : items[id].name}
            <span className="ml-auto pl-4 text-xs text-muted-foreground">x{count}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Use a Potion or a cure from the bag on a Pokémon */
function UseItem({ creature }: { creature: Creature }) {
  const usable = trainer.bag.filter(({ id }) => {
    const item = items[id];
    return item.kind === "heal" ? creature.hp > 0 && creature.hp < hp(creature) : item.kind === "cure" ? Boolean(creature.status) : false;
  });
  if (!usable.length) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          Use item
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {usable.map(({ id, count }) => (
          <DropdownMenuItem key={id} onSelect={() => session.useItem(id, creature) && toast.success(`${items[id].name} used on ${named(creature)}`)}>
            {items[id].name}
            <span className="ml-auto pl-4 text-xs text-muted-foreground">x{count}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreatureRow({ creature, children }: { creature: Creature; children: React.ReactNode }) {
  const ratio = creature.hp / hp(creature);
  return (
    <div className={cn("flex items-center gap-3 rounded-md border border-border p-2", creature.hp <= 0 && "opacity-60")}>
      <CanvasView
        className="h-[60px] w-[68px] overflow-hidden"
        make={() => portrait(creature.species, 1, creature.art)}
        deps={[creature.species, creature.art]}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="text-sm">
            {named(creature)}
            {creature.shiny ? " ✨" : ""}
          </b>
          <span className="rounded bg-muted px-1.5 text-[11px]">Lv {creature.level}</span>
          {species(creature.species).types.map((type) => (
            <TypeBadge key={type} type={type} />
          ))}
          {creature.status ? <StatusBadge status={creature.status} /> : null}
        </div>
        <div className="my-1 h-1.5 rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${ratio * 100}%`, background: ratio > 0.5 ? "#48d058" : ratio > 0.2 ? "#f8c030" : "#f05038" }}
          />
        </div>
        <small className="block truncate text-[11px] text-subtle-fg">
          HP {creature.hp}/{hp(creature)} · {creature.moves.map(({ key }) => assets.moves[key]?.name ?? key).join(", ")}
        </small>
        <small className="block truncate text-[11px] text-subtle-fg">
          <span title={abilityAbout(abilityOf(creature))}>{abilityName(abilityOf(creature)) || "No ability"}</span>
          {creature.nature ? ` · ${natureLabel(creature.nature)}` : ""}
          {creature.held ? ` · holds ${items[creature.held].name}` : ""}
        </small>
      </div>
      {children}
    </div>
  );
}

function Party({ close }: { close: () => void }) {
  useSession();
  const profile = trainer.profile;
  if (!profile) {
    return null;
  }
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Your Pokémon</DialogTitle>
          <DialogDescription>
            ₽{profile.money.toLocaleString()} ·{" "}
            {trainer.bag.length ? trainer.bag.map(({ id, count }) => `${count} ${items[id].name}`).join(" · ") : "Your bag is empty"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          {profile.party.map((creature, i) => (
            <CreatureRow key={i} creature={creature}>
              <UseItem creature={creature} />
              <HoldItem creature={creature} />
              {i ? (
                <Button size="sm" variant="outline" title="Send first in battle" onClick={() => session.moveCreature("lead", i)}>
                  Lead
                </Button>
              ) : (
                <span className="rounded bg-muted px-2 py-1 text-xs">Lead</span>
              )}
              {profile.party.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => session.moveCreature("box", i)}>
                  To box
                </Button>
              ) : null}
            </CreatureRow>
          ))}
        </div>
        {profile.box.length ? (
          <div className="grid gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">PC Box ({profile.box.length})</p>
            {profile.box.map((creature, i) => (
              <CreatureRow key={i} creature={creature}>
                {profile.party.length < 6 ? (
                  <Button size="sm" variant="outline" onClick={() => session.moveCreature("party", i)}>
                    To party
                  </Button>
                ) : null}
              </CreatureRow>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Trainer card

export function card() {
  return openDialog<void>((close) => <TrainerCard close={close} />);
}

function TrainerCard({ close }: { close: () => void }) {
  const profile = trainer.profile;
  if (!profile) {
    return null;
  }
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Trainer card</DialogTitle>
          <DialogDescription className="sr-only">Badges, Pokédex and progress</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
          <CanvasView make={() => preview(texture(profile.sprite, "down"), 4)} deps={[profile.sprite]} />
          <div>
            <h3 className="text-lg font-semibold">{profile.name}</h3>
            <p className="text-sm text-muted-foreground">
              Pokédex: {profile.seen.length} seen · {profile.caught.length} caught
            </p>
            <p className="text-sm text-muted-foreground">
              Trainers defeated: {profile.defeated.length} · Money: ₽{profile.money.toLocaleString()}
            </p>
          </div>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Badges ({profile.badges.length})</p>
        {profile.badges.length ? (
          <div className="grid gap-1">
            {profile.badges.map(({ badge, city, name }, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2">
                <Medal size={18} className="text-select" />
                <div>
                  <b className="block text-sm">{badge}</b>
                  <small className="text-xs text-subtle-fg">
                    Beat {name} in {city}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Hint>Beat gym leaders in your friends&apos; cities to earn badges.</Hint>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Caught Pokémon</p>
        <div className="flex flex-wrap gap-1">
          {profile.caught
            .slice()
            .sort((a, b) => a - b)
            .map((id) => (
              <span key={id} title={species(id)?.name}>
                <CanvasView className="h-[46px] w-[56px] overflow-hidden" make={() => portrait(id, 0.8)} deps={[id]} />
              </span>
            ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={async () => {
              if (await confirm("Start over?", { text: "This erases your trainer, party, badges and story progress.", action: "Start over", danger: true })) {
                close();
                await session.startOver();
              }
            }}
          >
            <Trash />
            Start over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Journal

/** The player's Journal: what to do next in the main story, and side quests in progress */
export function journalDialog() {
  return openDialog<void>((close) => <Journal close={close} />);
}

function Journal({ close }: { close: () => void }) {
  const city = session.city;
  const page = journal(city, (id) => trainer.done(city.id, id));
  const entry = ({ name, next, done, total, quest }: Entry) => (
    <div key={quest?.id ?? "main"} className={cn("grid gap-1 rounded-lg border p-3", next ? "border-border bg-card" : "border-transparent bg-muted/50")}>
      <div className="flex items-center gap-2">
        {quest ? <Scroll size={16} className="shrink-0 text-select" /> : <Flag size={16} className="shrink-0" />}
        <b className="min-w-0 flex-1 truncate text-sm">{name}</b>
        <span className="font-mono text-xs text-subtle-fg">
          {done}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-select" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">{next ? goal(next) : quest ? "Complete!" : "The main story is complete!"}</p>
    </div>
  );
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Journal</DialogTitle>
          <DialogDescription>{city.name}</DialogDescription>
        </DialogHeader>
        {!page.main && !page.active.length && !page.complete.length ? <Hint>This town has no story yet. Explore, battle and catch Pokémon!</Hint> : null}
        {page.main ? entry(page.main) : null}
        {page.active.length ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Side quests</p>
            <div className="grid gap-2">{page.active.map(entry)}</div>
          </>
        ) : null}
        {page.complete.length ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Completed</p>
            <div className="grid gap-2">{page.complete.map(entry)}</div>
          </>
        ) : null}
        {page.main || page.active.length ? null : <Hint>Talk to people around town: some of them need your help.</Hint>}
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Pokémon here (like the DexNav): the wild Pokémon of the current map

export function wildDialog() {
  return openDialog<void>((close) => <WildHere close={close} />);
}

function WildHere({ close }: { close: () => void }) {
  const map = session.area;
  const profile = trainer.profile;
  const now = period(map.time);
  const found = living(map);
  const seen = new Set(profile?.seen ?? []),
    caught = new Set(profile?.caught ?? []);
  const groups = [
    { key: "walk", label: "In the grass and on foot", list: found.walk },
    { key: "surf", label: "Surfing", list: found.surf },
    { key: "fish", label: "Fishing", list: found.fish },
  ] as const;
  const times = { morning: "Mornings", day: "Daytime", night: "Nights" };
  const rodNames = { good: "Good Rod", super: "Super Rod" };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pokémon here</DialogTitle>
          <DialogDescription>
            {map.name} · it&apos;s {now === "morning" ? "morning" : now === "night" ? "night" : "daytime"}
          </DialogDescription>
        </DialogHeader>
        {groups.every(({ list }) => !list.length) ? <Hint>No wild Pokémon live on this map.</Hint> : null}
        {groups
          .filter(({ list }) => list.length)
          .map(({ key, label, list }) => (
            <div key={key} className="grid gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">{label}</p>
              <ul className="grid grid-cols-2 gap-1.5">
                {list.map((wild, i) => {
                  const known = seen.has(wild.species) || caught.has(wild.species);
                  const out = Boolean(wild.time && wild.time !== now);
                  return (
                    <li
                      key={i}
                      className={cn("flex items-center gap-2 rounded-md border border-border bg-card p-1.5", out && "opacity-50")}
                      title={out ? `Only ${times[wild.time!].toLowerCase()}` : undefined}
                    >
                      <CanvasView
                        className={cn("h-[30px] w-[34px] shrink-0 overflow-hidden", !known && "brightness-0 opacity-60")}
                        make={() => portrait(wild.species, 1)}
                        deps={[wild.species]}
                      />
                      <span className="grid min-w-0 flex-1">
                        <span className="flex items-center gap-1 truncate text-sm">
                          {known ? species(wild.species)?.name : "???"}
                          {caught.has(wild.species) ? <span className="size-2 shrink-0 rounded-full bg-red-500" title="Caught" /> : null}
                        </span>
                        <span className="truncate text-[11px] text-subtle-fg">
                          Lv {wild.min === wild.max ? wild.min : `${wild.min}–${wild.max}`}
                          {wild.time ? ` · ${times[wild.time]}` : ""}
                          {wild.rod ? ` · ${rodNames[wild.rod]}` : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        {found.fish.length && !bestRod((id) => trainer.count(id)) ? <Hint>You need a fishing rod to hook the Pokémon in the water.</Hint> : null}
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Town Map: the town's outdoor maps as they're joined, and where the player is

export function townMap() {
  return openDialog<void>((close) => <TownMap close={close} />);
}

/** The outdoor map a map belongs to: itself, or the one with a door leading (through other rooms) to it */
function outdoorOf(world: City, map: City, seen = new Set<City>()): { outdoor: City; door?: { x: number; y: number } } | null {
  if (map === world || map.outdoor) {
    return { outdoor: map };
  }
  seen.add(map);
  for (const other of [world, ...world.interiors]) {
    const door = other.doors.find(({ to }) => to === map.id);
    if (door && !seen.has(other)) {
      const found = outdoorOf(world, other, seen);
      if (found) return found.door ? found : { outdoor: found.outdoor, door };
    }
  }
  return null;
}

function TownMap({ close }: { close: () => void }) {
  const world = session.city;
  const placed = outdoors(world);
  const here = outdoorOf(world, session.area);
  const minX = Math.min(...placed.map(({ x }) => x)),
    minY = Math.min(...placed.map(({ y }) => y));
  const maxX = Math.max(...placed.map(({ x, map }) => x + map.width)),
    maxY = Math.max(...placed.map(({ y, map }) => y + map.height));
  const scale = Math.max(1, Math.min(8, 640 / (maxX - minX), 420 / (maxY - minY)));
  const [pictures] = useState(() => new Map(placed.map(({ map }) => [map, session.map.picture(map, Math.min(1, scale / 16)).toDataURL()])));
  //Where the player is: their tile outdoors, or the door of the building they're in
  const spot = (() => {
    if (!here) return null;
    const item = placed.find(({ map }) => map === here.outdoor);
    const tile = here.door ?? (session.area === here.outdoor ? session.play?.position : null);
    return item && tile ? { x: item.x + tile.x + 0.5, y: item.y + tile.y + 0.5 } : null;
  })();
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Town Map</DialogTitle>
          <DialogDescription>
            {here
              ? session.area === here.outdoor
                ? here.outdoor.name || world.name
                : `${session.area.name}, ${here.outdoor === world ? world.name : here.outdoor.name}`
              : world.name}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto rounded-lg bg-[#16324a] p-4">
          <div className="relative mx-auto" style={{ width: (maxX - minX) * scale, height: (maxY - minY) * scale }}>
            {placed.map(({ map, x, y }) => (
              <div
                key={map.id}
                className={cn("absolute overflow-hidden rounded-sm ring-2", map === here?.outdoor ? "ring-select" : "ring-black/40")}
                style={{
                  left: (x - minX) * scale,
                  top: (y - minY) * scale,
                  width: map.width * scale,
                  height: map.height * scale,
                  backgroundImage: `url(${pictures.get(map)})`,
                  backgroundSize: "100% 100%",
                  imageRendering: "pixelated",
                }}
              >
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-pixel text-[10px] text-white">
                  {map === world ? world.name : map.name}
                </span>
              </div>
            ))}
            {spot ? (
              <span
                className="town-map-you absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500"
                style={{ left: (spot.x - minX) * scale, top: (spot.y - minY) * scale }}
                aria-label="You are here"
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Poké Mart

/** Buy items with the trainer's money (opened by talking to a Poké Mart clerk) */
export function shop(stock: ItemId[], { speaker = "" }: { speaker?: string } = {}) {
  return openDialog<void>((close) => <Shop stock={stock} speaker={speaker} close={close} />).then(() => undefined);
}

function Shop({ stock, speaker, close }: { stock: ItemId[]; speaker: string; close: () => void }) {
  useSession();
  const profile = trainer.profile;
  const [counts, setCounts] = useState<Partial<Record<ItemId, number>>>({});
  if (!profile) {
    return null;
  }
  const count = (id: ItemId) => counts[id] ?? 1;
  const set = (id: ItemId, value: number) => setCounts({ ...counts, [id]: Math.max(1, Math.min(99, value)) });
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            Poké Mart<span className="rounded-md bg-muted px-2.5 py-1 font-mono text-sm">₽{profile.money.toLocaleString()}</span>
          </DialogTitle>
          <DialogDescription>{speaker ? `${speaker}: ` : ""}What would you like?</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1.5">
          {stock.map((id) => {
            const item = items[id];
            const cost = item.price * count(id);
            return (
              <li key={id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <div className="min-w-0 flex-1">
                  <b className="block text-sm">
                    {item.name} <span className="font-mono text-xs font-normal text-muted-foreground">₽{item.price}</span>
                  </b>
                  <small className="block text-xs text-subtle-fg">
                    {item.about} · In bag: {trainer.count(id)}
                  </small>
                </div>
                <div className="flex items-center rounded-md border border-border">
                  <button
                    aria-label={`Fewer ${item.name}s`}
                    onClick={() => set(id, count(id) - 1)}
                    className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-7 text-center font-mono text-sm tabular-nums">{count(id)}</span>
                  <button
                    aria-label={`More ${item.name}s`}
                    onClick={() => set(id, count(id) + 1)}
                    className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <Button
                  size="sm"
                  disabled={profile.money < cost}
                  title={profile.money < cost ? "Not enough money" : undefined}
                  onClick={() => session.buy(id, count(id)) && toast.success(`Bought ${itemCount(id, count(id))}`)}
                >
                  ₽{cost.toLocaleString()}
                </Button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Come again!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
