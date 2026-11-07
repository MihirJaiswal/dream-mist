"use client";

import { confirm } from "@/components/editor/account-dialogs";
import { openDialog } from "@/components/editor/dialogs";
import { useSession } from "@/components/editor/hooks";
import { GbaWindow, TypeTag, trainerId } from "@/components/editor/gba-screens";
import { CanvasView } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { artwork, npc as texture, portrait, preview, species } from "@/game/assets";
import { bestRod, iconOf, type ItemId, itemCount, items } from "@/game/items";
import { period } from "@/game/atmosphere";
import { living } from "@/game/encounters";
import { outdoors } from "@/game/region";
import type { City } from "@/game/data";
import { session } from "@/game/session";
import { type Entry, goal, journal } from "@/game/story";
import { trainer } from "@/game/trainer";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

//=================================================================================================
// Pokédex (start menu)

export function pokedex() {
  return openDialog<void>((close) => <Pokedex close={close} />);
}

function Pokedex({ close }: { close: () => void }) {
  const profile = trainer.profile;
  const [cursor, setCursor] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);
  if (!profile) {
    return null;
  }
  const seen = [...new Set(profile.seen)].sort((a, b) => a - b);
  const caught = new Set(profile.caught);
  const id = seen[cursor];
  const data = id ? species(id) : null;
  const number = (id: number) => `No.${String(id).padStart(3, "0")}`;
  return (
    <GbaWindow
      title="POKéDEX"
      info={
        <>
          SEEN <b>{seen.length}</b> OWN <b>{caught.size}</b>
        </>
      }
      theme="gba-dex"
      close={close}
      onKey={(key) => {
        if ((key === "up" || key === "down") && seen.length) {
          setCursor((cursor + (key === "down" ? 1 : seen.length - 1)) % seen.length);
          return true;
        }
      }}
    >
      <div className="entry">
        <div className="screen">{data ? <img key={id} src={artwork(id)} alt={data.name} draggable={false} /> : <p>Pokémon you meet show up here.</p>}</div>
        {data ? (
          <>
            <div className="plate">
              <span>{number(id)}</span>
              <b>{data.name}</b>
              {caught.has(id) ? <img src={iconOf("poke-ball")} alt="Caught" draggable={false} /> : null}
            </div>
            <div className="types">{caught.has(id) ? data.types.map((type) => <TypeTag key={type} type={type} />) : <span>TYPE ?</span>}</div>
          </>
        ) : null}
      </div>
      <ul className="list" ref={list}>
        {seen.map((id, i) => (
          <li key={id}>
            <button className={cn(i === cursor && "picked")} onClick={() => setCursor(i)}>
              <span className="ball">{caught.has(id) ? <img src={iconOf("poke-ball")} alt="Caught" draggable={false} /> : null}</span>
              <span className="no">{number(id)}</span>
              <span className="name">{species(id)?.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </GbaWindow>
  );
}

//=================================================================================================
// Trainer card

export function card() {
  return openDialog<void>((close) => <TrainerCard close={close} />);
}

/** Badge colors, in the order they're earned */
const badgeColors = ["#b0b8c8", "#e86048", "#f8c838", "#58a8e8", "#a868d8", "#e898b8", "#58c078", "#f09838"];

function TrainerCard({ close }: { close: () => void }) {
  const profile = trainer.profile;
  //Asking to start over: the question hears the keys
  const [asking, setAsking] = useState(false);
  if (!profile) {
    return null;
  }
  const slots = Math.max(8, profile.badges.length);
  const caught = [...new Set(profile.caught)].sort((a, b) => a - b);
  return (
    <GbaWindow title="TRAINER CARD" info={`IDNo.${trainerId(profile.name)}`} theme="gba-card" close={close} keys={!asking}>
      <div className="card">
        <dl>
          <div>
            <dt>NAME</dt>
            <dd>{profile.name}</dd>
          </div>
          <div>
            <dt>MONEY</dt>
            <dd>₽{profile.money.toLocaleString()}</dd>
          </div>
          <div>
            <dt>POKéDEX</dt>
            <dd>
              {caught.length}
              <small> / {new Set(profile.seen).size} seen</small>
            </dd>
          </div>
          <div>
            <dt>TRAINERS BEATEN</dt>
            <dd>{profile.defeated.length}</dd>
          </div>
        </dl>
        <div className="photo">
          <CanvasView make={() => preview(texture(profile.sprite, "down"), 4)} deps={[profile.sprite]} />
        </div>
      </div>
      <div className="case">
        <h3>BADGES</h3>
        <div className="badges">
          {Array.from({ length: slots }, (_, i) => {
            const won = profile.badges[i];
            return (
              <span
                key={i}
                className={cn("badge", won && "won")}
                style={won ? { background: badgeColors[i % badgeColors.length] } : undefined}
                title={won ? `${won.badge}: beat ${won.name} in ${won.city}` : undefined}
              />
            );
          })}
        </div>
        {profile.badges.length ? null : <p>Beat gym leaders in your friends&apos; cities to earn badges.</p>}
      </div>
      <div className="case">
        <h3>CAUGHT</h3>
        <div className="caught">
          {caught.length ? null : <p>Pokémon you catch show up here.</p>}
          {caught.map((id) => (
            <span key={id} title={species(id)?.name}>
              <CanvasView make={() => portrait(id, 0.8)} deps={[id]} />
            </span>
          ))}
        </div>
      </div>
      <button
        className="start-over"
        onClick={async () => {
          setAsking(true);
          const sure = await confirm("Start over?", {
            text: "This erases your trainer, party, badges and story progress.",
            action: "Start over",
            danger: true,
          });
          setAsking(false);
          if (sure) {
            close();
            await session.startOver();
          }
        }}
      >
        START OVER
      </button>
    </GbaWindow>
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
    <article key={quest?.id ?? "main"} className={cn("quest", !next && "done", !quest && "main")}>
      <header>
        <i>{quest ? "◆" : "★"}</i>
        <b>{name}</b>
        <span>
          {done}/{total}
        </span>
      </header>
      <div className="progress">
        <i style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <p>{next ? goal(next) : quest ? "Complete!" : total > 1 ? "The main story is complete!" : "Done! More is on its way."}</p>
    </article>
  );
  return (
    <GbaWindow title="JOURNAL" info={city.name} theme="gba-journal" close={close}>
      <div className="paper">
        {!page.main && !page.active.length && !page.complete.length ? (
          <p className="note">This town has no story yet. Explore, battle and catch Pokémon!</p>
        ) : null}
        {page.main ? entry(page.main) : null}
        {page.active.length ? (
          <>
            <h3>SIDE QUESTS</h3>
            {page.active.map(entry)}
          </>
        ) : null}
        {page.complete.length ? (
          <>
            <h3>COMPLETED</h3>
            {page.complete.map(entry)}
          </>
        ) : null}
        {page.main || page.active.length ? null : <p className="note">Talk to people around town: some of them need your help.</p>}
      </div>
    </GbaWindow>
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
    { key: "walk", label: "GRASS AND ON FOOT", list: found.walk },
    { key: "surf", label: "SURFING", list: found.surf },
    { key: "fish", label: "FISHING", list: found.fish },
  ] as const;
  const times = { morning: "Mornings", day: "Daytime", night: "Nights" };
  const rodNames = { good: "Good Rod", super: "Super Rod" };
  return (
    <GbaWindow title="POKéMON HERE" info={`${map.name} · ${now === "morning" ? "MORNING" : now === "night" ? "NIGHT" : "DAY"}`} theme="gba-wild" close={close}>
      {groups.every(({ list }) => !list.length) ? <p className="note">No wild Pokémon live on this map.</p> : null}
      {groups
        .filter(({ list }) => list.length)
        .map(({ key, label, list }) => (
          <section key={key}>
            <h3>{label}</h3>
            <ul>
              {list.map((wild, i) => {
                const known = seen.has(wild.species) || caught.has(wild.species);
                const out = Boolean(wild.time && wild.time !== now);
                return (
                  <li key={i} className={cn(out && "out")} title={out ? `Only ${times[wild.time!].toLowerCase()}` : undefined}>
                    <CanvasView className={cn("icon", !known && "unknown")} make={() => portrait(wild.species, 1)} deps={[wild.species]} />
                    <span className="name">
                      {known ? species(wild.species)?.name : "???"}
                      {caught.has(wild.species) ? <img src={iconOf("poke-ball")} alt="Caught" draggable={false} /> : null}
                    </span>
                    <small>
                      Lv.{wild.min === wild.max ? wild.min : `${wild.min}-${wild.max}`}
                      {wild.time ? ` · ${times[wild.time]}` : ""}
                      {wild.rod ? ` · ${rodNames[wild.rod]}` : ""}
                    </small>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      {found.fish.length && !bestRod((id) => trainer.count(id)) ? <p className="note">You need a fishing rod to hook the Pokémon in the water.</p> : null}
    </GbaWindow>
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
  const width = maxX - minX,
    height = maxY - minY;
  const scale = Math.max(1, Math.min(8, 640 / width, 420 / height));
  const [pictures] = useState(() => new Map(placed.map(({ map }) => [map, session.map.picture(map, Math.min(1, scale / 16)).toDataURL()])));
  //Where the player is: their tile outdoors, or the door of the building they're in
  const spot = (() => {
    if (!here) return null;
    const item = placed.find(({ map }) => map === here.outdoor);
    const tile = here.door ?? (session.area === here.outdoor ? session.play?.position : null);
    return item && tile ? { x: item.x + tile.x + 0.5, y: item.y + tile.y + 0.5 } : null;
  })();
  const percent = (value: number, of: number) => `${(value / of) * 100}%`;
  return (
    <GbaWindow
      title="TOWN MAP"
      info={
        here
          ? session.area === here.outdoor
            ? here.outdoor.name || world.name
            : `${session.area.name}, ${here.outdoor === world ? world.name : here.outdoor.name}`
          : world.name
      }
      theme="gba-map"
      close={close}
    >
      <div className="fit">
        <div className="area" style={{ aspectRatio: `${width} / ${height}`, width: `min(100cqw, 100cqh * ${width / height})` }}>
          {placed.map(({ map, x, y }) => (
            <div
              key={map.id}
              className={cn("piece", map === here?.outdoor && "here")}
              style={{
                left: percent(x - minX, width),
                top: percent(y - minY, height),
                width: percent(map.width, width),
                height: percent(map.height, height),
                backgroundImage: `url(${pictures.get(map)})`,
              }}
            >
              <span>{map === world ? world.name : map.name}</span>
            </div>
          ))}
          {spot ? (
            <span className="town-map-you" style={{ left: percent(spot.x - minX, width), top: percent(spot.y - minY, height) }} aria-label="You are here" />
          ) : null}
        </div>
      </div>
    </GbaWindow>
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
