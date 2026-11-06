"use client";

/**
 * Party, summary, PC box and bag screens drawn like the Game Boy Advance games.
 * The keyboard drives them like a GBA: arrows (or WASD) move, Z, Space, Enter or E pick, X or Escape go back.
 * Each opens on top of the game (and of battles) and resolves when it closes.
 */

import { openDialog } from "@/components/editor/dialogs";
import { useSession } from "@/components/editor/hooks";
import { close as closeMenu } from "@/components/editor/start-menu";
import { CanvasView } from "@/components/editor/widgets";
import { abilityAbout, abilityName } from "@/game/abilities";
import { artwork, assets, battleSprite, type Move, portrait, species } from "@/game/assets";
import { colors, statusLabels } from "@/game/battle";
import { helps } from "@/game/growth";
import { iconOf, type ItemId, items, type Pocket, pocketOf, pockets } from "@/game/items";
import { natureLabel } from "@/game/natures";
import { session } from "@/game/session";
import { abilityOf, type Creature, experience, friendshipText, hp, named, stat, trainer } from "@/game/trainer";
import { cn } from "@/lib/utils";
import { useEffect, useEffectEvent, useState } from "react";

//=================================================================================================
// Keys

export type Key = "up" | "down" | "left" | "right" | "a" | "b";
const keyOf: Record<string, Key> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  z: "a",
  " ": "a",
  enter: "a",
  e: "a",
  x: "b",
  escape: "b",
  backspace: "b",
};

/** Screens stacked on top of each other: only the top one hears the keys (null: a screen to type in, where keys type) */
const stack = [] as (((key: Key) => void) | null)[];
let listening = false;

function onKeydown(event: KeyboardEvent) {
  const key = keyOf[event.key.toLowerCase()];
  const top = stack[stack.length - 1];
  if (top === null) {
    return;
  }
  if (!top || !key) {
    return;
  }
  //No other listener hears it: a screen opened by this key must not get it too
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat && (key === "a" || key === "b")) {
    return;
  }
  top(key);
}

/** Hear the keys while this screen is on top (a screen hidden behind another window it opened passes `enabled` false: the keys go past it) */
export function useKeys(handler: (key: Key) => void, enabled = true) {
  const latest = useEffectEvent(handler);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const listener = (key: Key) => latest(key);
    stack.push(listener);
    if (!listening) {
      listening = true;
      document.addEventListener("keydown", onKeydown, true);
    }
    return () => void stack.splice(stack.indexOf(listener), 1);
  }, [enabled]);
}

/** A screen to type in is on top: the screens under it don't hear the keys, and letters type */
export function useTyping() {
  useEffect(() => {
    stack.push(null);
    return () => void stack.splice(stack.lastIndexOf(null), 1);
  }, []);
}

/** Does a trainer look like a girl (the bag and the opening show May then) */
export function girlish(sprite = "") {
  return /^(em_may|may|lass|twin|aroma|.*_f\d?|.*female.*)$/i.test(sprite);
}

/** A small menu in the corner (SUMMARY, SWITCH, CANCEL…): the last choice is the way out */
export type Choices = { title: string; options: { label: string; run: () => void }[]; cursor: number };

export function ChoiceBox({ choices, onPick, onPoint }: { choices: Choices; onPick: (index: number) => void; onPoint: (index: number) => void }) {
  return (
    <div className="gba-choices" role="menu">
      {choices.options.map(({ label }, i) => (
        <button key={label} role="menuitem" className={cn(i === choices.cursor && "picked")} onMouseEnter={() => onPoint(i)} onClick={() => onPick(i)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Move a choice box cursor, or pick (B picks the last choice) */
export function steer(choices: Choices, key: Key, set: (choices: Choices | null) => void) {
  const count = choices.options.length;
  if (key === "up" || key === "down") {
    set({ ...choices, cursor: (choices.cursor + (key === "down" ? 1 : count - 1)) % count });
  } else if (key === "a" || key === "b") {
    set(null);
    choices.options[key === "a" ? choices.cursor : count - 1].run();
  }
}

/** HP bar with its "HP" tag */
function HpBar({ creature }: { creature: Creature }) {
  const ratio = Math.max(0, creature.hp / hp(creature));
  return (
    <span className="gba-hp">
      <b>HP</b>
      <span>
        <i style={{ width: `${ratio * 100}%`, background: ratio > 0.5 ? "#58d068" : ratio > 0.2 ? "#f8c030" : "#f05838" }} />
      </span>
    </span>
  );
}

/** Type tag in its color */
export function TypeTag({ type }: { type: string }) {
  return (
    <span className="gba-type" style={{ background: colors[type] ?? "#888" }}>
      {type.toUpperCase()}
    </span>
  );
}

/** ♂ or ♀ after a Pokémon's name (nothing for genderless ones) */
export function GenderMark({ creature }: { creature: Creature }) {
  return creature.gender ? (
    <span className={cn("gba-gender", creature.gender)} aria-label={creature.gender}>
      {creature.gender === "male" ? "♂" : "♀"}
    </span>
  ) : null;
}

/** Condition tag (SLP, PSN, PAR, BRN) */
function StatusTag({ creature }: { creature: Creature }) {
  if (!creature.status) {
    return null;
  }
  const { label, color } = statusLabels[creature.status];
  return (
    <span className="gba-status" style={{ background: color }}>
      {label}
    </span>
  );
}

//=================================================================================================
// Party

/** Choosing a Pokémon for something (switching in battle, using an item): a message, an action offered on it, and who can be chosen */
export type Pick = { message: string; action?: string; can?: (creature: Creature, index: number) => true | string; cancel?: boolean };

/** Open the party, resolves with the chosen Pokémon's index when picking (null when cancelled) */
export function party(pick?: Pick) {
  return openDialog<number | null>((close) => <PartyScreen pick={pick} close={close} />).then((value) => value ?? null);
}

function PartyScreen({ pick, close }: { pick?: Pick; close: (value?: number | null) => void }) {
  useSession();
  const list = trainer.profile?.party ?? [];
  const base = pick?.message ?? "Choose a Pokémon.";
  //Slots, then (outside battles) the PC BOX button, then CANCEL
  const box = !pick;
  const cancel = pick?.cancel === false ? -1 : 7;
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState(base);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [away, setAway] = useState(false);
  const say = (text: string) => setMessage(text);
  //Hide while another screen is on top
  const open = async <T,>(screen: () => Promise<T>) => {
    setAway(true);
    const value = await screen();
    setAway(false);
    return value;
  };
  const choose = (index: number) => {
    const creature = list[index];
    if (!creature) {
      return;
    }
    if (moving !== null) {
      if (moving !== index) {
        session.swapCreatures(moving, index);
      }
      setMoving(null);
      setCursor(index);
      return say(base);
    }
    if (pick) {
      const allowed = pick.can?.(creature, index) ?? true;
      if (allowed !== true) {
        return say(allowed);
      }
      if (!pick.action) {
        return close(index);
      }
      return setChoices({
        title: `Do what with ${named(creature)}?`,
        cursor: 0,
        options: [
          { label: pick.action, run: () => close(index) },
          { label: "SUMMARY", run: () => void open(() => summary(list, index)) },
          { label: "CANCEL", run: () => say(base) },
        ],
      });
    }
    const held = creature.held;
    setChoices({
      title: "Do what with this PKMN?",
      cursor: 0,
      options: [
        { label: "SUMMARY", run: () => void open(() => summary(list, index)) },
        ...(list.length > 1 ? [{ label: "SWITCH", run: () => (setMoving(index), say("Move to where?")) }] : []),
        {
          label: "ITEM",
          run: () =>
            setChoices({
              title: held ? `${named(creature)} is holding ${items[held].name}.` : "Do what with an item?",
              cursor: 0,
              options: [
                {
                  label: "GIVE",
                  run: async () => {
                    const id = await open(() => bag({ give: true }));
                    if (id && session.hold(creature, id)) {
                      say(`${named(creature)} was given the ${items[id].name} to hold.`);
                    }
                  },
                },
                ...(held
                  ? [{ label: "TAKE", run: () => (session.hold(creature, null), say(`Received the ${items[held].name} from ${named(creature)}.`)) }]
                  : []),
                { label: "CANCEL", run: () => say(base) },
              ],
            }),
        },
        ...(list.length > 1
          ? [{ label: "PC BOX", run: () => (session.moveCreature("box", index), setCursor(0), say(`${named(creature)} was sent to the PC.`)) }]
          : []),
        { label: "CANCEL", run: () => say(base) },
      ],
    });
  };
  const activate = (at: number) => {
    if (at === 7) {
      return moving !== null ? (setMoving(null), say(base)) : close(null);
    }
    if (at === 6) {
      return void open(() => pcBox());
    }
    choose(at);
  };
  useKeys((key) => {
    if (choices) {
      return steer(choices, key, setChoices);
    }
    if (key === "b") {
      if (moving !== null) {
        setMoving(null);
        return say(base);
      }
      return cancel > 0 ? close(null) : undefined;
    }
    if (key === "a") {
      return activate(cursor);
    }
    //Slots in two columns (even ones on the left), then the buttons under them
    const last = list.length - 1;
    if (cursor >= 6) {
      if (key === "up") setCursor(last);
      if (key === "left" && cursor === 7 && box) setCursor(6);
      if (key === "right" && cursor === 6 && cancel > 0) setCursor(7);
      return;
    }
    if (key === "left" || key === "right") {
      const other = cursor ^ 1;
      if (other <= last) setCursor(other);
    } else if (key === "up" && cursor >= 2) {
      setCursor(cursor - 2);
    } else if (key === "down") {
      setCursor(cursor + 2 <= last ? cursor + 2 : cancel > 0 ? 7 : box ? 6 : cursor);
    }
  }, !away);
  if (away) {
    return null;
  }
  return (
    <div className="gba-screen" role="dialog" aria-label="Pokémon">
      <div className="gba-frame gba-party">
        <div className="slots">
          {Array.from({ length: 6 }, (_, i) => {
            const creature = list[i];
            if (!creature) {
              return <div key={i} className={cn("slot empty", i % 2 && "right")} />;
            }
            const ratio = creature.hp / hp(creature);
            return (
              <button
                key={i}
                className={cn("slot", i % 2 && "right", cursor === i && "picked", creature.hp <= 0 && "fainted", moving === i && "moving")}
                onMouseEnter={() => !choices && setCursor(i)}
                onClick={() => !choices && activate(i)}
              >
                <img className="ball" src={iconOf("poke-ball")} alt="" draggable={false} />
                <CanvasView className="icon" make={() => portrait(creature.species, 1, creature.art)} deps={[creature.species, creature.art]} />
                <span className="name">
                  {named(creature)}
                  <GenderMark creature={creature} />
                </span>
                {creature.held ? <img className="held" src={iconOf(creature.held)} alt={items[creature.held].name} draggable={false} /> : null}
                <span className="level">{creature.status ? <StatusTag creature={creature} /> : `Lv.${creature.level}`}</span>
                <HpBar creature={creature} />
                <span className={cn("hp", ratio <= 0 && "out")}>
                  {creature.hp}/ {hp(creature)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="bottom">
          <div className="message">{choices?.title ?? message}</div>
          {box ? (
            <button className={cn("button box", cursor === 6 && "picked")} onMouseEnter={() => setCursor(6)} onClick={() => activate(6)}>
              PC BOX
            </button>
          ) : null}
          {cancel > 0 ? (
            <button className={cn("button", cursor === 7 && "picked")} onMouseEnter={() => setCursor(7)} onClick={() => activate(7)}>
              CANCEL
            </button>
          ) : null}
        </div>
        {choices ? (
          <ChoiceBox choices={choices} onPoint={(i) => setChoices({ ...choices, cursor: i })} onPick={(i) => (setChoices(null), choices.options[i].run())} />
        ) : null}
      </div>
    </div>
  );
}

//=================================================================================================
// PC box

export function pcBox() {
  return openDialog<void>((close) => <BoxScreen close={close} />);
}

function BoxScreen({ close }: { close: () => void }) {
  useSession();
  const list = trainer.profile?.box ?? [];
  const full = (trainer.profile?.party.length ?? 0) >= 6;
  const [cursor, setCursor] = useState(0);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [message, setMessage] = useState("Choose a Pokémon to withdraw.");
  const [away, setAway] = useState(false);
  const columns = 6;
  const pickAt = (index: number) => {
    const creature = list[index];
    if (!creature) {
      return;
    }
    setChoices({
      title: `${named(creature)} is selected.`,
      cursor: 0,
      options: [
        {
          label: "WITHDRAW",
          run: () => {
            if (full) {
              return setMessage("Your party is full!");
            }
            session.moveCreature("party", index);
            setCursor(Math.max(0, Math.min(cursor, list.length - 2)));
            setMessage(`${named(creature)} was added to your party.`);
          },
        },
        {
          label: "SUMMARY",
          run: async () => {
            setAway(true);
            await summary(list, index);
            setAway(false);
          },
        },
        { label: "CANCEL", run: () => {} },
      ],
    });
  };
  useKeys((key) => {
    if (choices) {
      return steer(choices, key, setChoices);
    }
    const steps = { left: -1, right: 1, up: -columns, down: columns } as Record<string, number>;
    if (key === "b") {
      return close();
    }
    if (key === "a") {
      return pickAt(cursor);
    }
    const next = cursor + steps[key];
    if (next >= 0 && next < list.length) {
      setCursor(next);
    }
  }, !away);
  if (away) {
    return null;
  }
  const current = list[cursor];
  return (
    <div className="gba-screen" role="dialog" aria-label="PC box">
      <div className="gba-frame gba-box">
        <div className="title">
          PC BOX <small>{list.length}</small>
        </div>
        <div className="grid">
          {list.length ? null : <p className="empty">The box is empty.</p>}
          {list.map((creature, i) => (
            <button
              key={i}
              className={cn("cell", i === cursor && "picked")}
              onMouseEnter={() => !choices && setCursor(i)}
              onClick={() => !choices && (setCursor(i), pickAt(i))}
            >
              <CanvasView make={() => portrait(creature.species, 1, creature.art)} deps={[creature.species, creature.art]} />
            </button>
          ))}
        </div>
        <div className="bottom">
          <div className="message">{choices?.title ?? (current ? `${named(current)} Lv.${current.level} · ${message}` : message)}</div>
          <button className="button" onClick={() => close()}>
            CANCEL
          </button>
        </div>
        {choices ? (
          <ChoiceBox choices={choices} onPoint={(i) => setChoices({ ...choices, cursor: i })} onPick={(i) => (setChoices(null), choices.options[i].run())} />
        ) : null}
      </div>
    </div>
  );
}

//=================================================================================================
// Summary

/** Summary pages, like Emerald's */
const pages = ["POKéMON INFO", "POKéMON SKILLS", "BATTLE MOVES"] as const;

/** A Pokémon's summary: up and down go through the list, left and right through the pages */
export function summary(list: Creature[], index: number) {
  return openDialog<void>((close) => <SummaryScreen list={list} start={index} close={close} />);
}

/** Stat names, in the order of `stat` */
const statNames = ["HP", "ATTACK", "DEFENSE", "SP. ATK", "SP. DEF", "SPEED"];

/** Stage names for move effects */
const stageNames: Record<string, string> = {
  attack: "Attack",
  defense: "Defense",
  spatk: "Sp. Atk",
  spdef: "Sp. Def",
  speed: "Speed",
  accuracy: "accuracy",
  evasion: "evasiveness",
};

/** What a move does, in a sentence or two */
function moveAbout(move: Move) {
  const parts = [] as string[];
  if (move.priority > 0) parts.push("Strikes first.");
  if (move.hits) parts.push(`Hits ${move.hits[0] === move.hits[1] ? move.hits[0] : `${move.hits[0]} to ${move.hits[1]}`} times.`);
  if (move.drain && move.drain > 0) parts.push(`Restores HP by ${move.drain}% of the damage dealt.`);
  if (move.drain && move.drain < 0) parts.push(`The user takes ${-move.drain}% of the damage as recoil.`);
  if (move.heal) parts.push(`Restores ${move.heal}% of the user's max HP.`);
  if (move.protect) parts.push("Protects the user from moves this turn.");
  if (move.crit) parts.push("Lands critical hits more often.");
  if (move.flinch) parts.push(`May make the target flinch (${move.flinch}%).`);
  const effect = move.effect;
  const chance = effect && effect.chance < 100 ? ` (${effect.chance}%)` : "";
  if (effect?.ailment) {
    parts.push(
      `${effect.chance < 100 ? "May" : "Will"} ${{ sleep: "put the target to sleep", poison: "poison the target", paralysis: "paralyze the target", burn: "burn the target" }[effect.ailment]}${chance}.`,
    );
  }
  for (const [name, change] of effect?.stats ?? []) {
    parts.push(
      `${change > 0 ? "Raises" : "Lowers"} ${effect!.self ? "the user's" : "the target's"} ${stageNames[name] ?? name}${Math.abs(change) > 1 ? " sharply" : ""}${chance}.`,
    );
  }
  return parts.join(" ") || (move.power ? "A plain attack." : "");
}

/** Trainer ID shown on the summary (made from the trainer's name, so it stays the same) */
function trainerId(name: string) {
  let hash = 7;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 65536;
  }
  return String(hash).padStart(5, "0");
}

function SummaryScreen({ list, start, close }: { list: Creature[]; start: number; close: () => void }) {
  useSession();
  const [index, setIndex] = useState(start);
  const [page, setPage] = useState(0);
  const [move, setMove] = useState(0);
  const creature = list[index] ?? list[0];
  useKeys((key) => {
    if (key === "b" || (key === "a" && page < 2)) {
      return close();
    }
    if (key === "left" || key === "right") {
      return setPage((page + (key === "right" ? 1 : pages.length - 1)) % pages.length);
    }
    if (page === 2 && (key === "up" || key === "down")) {
      const count = Math.max(1, creature.moves.length);
      return setMove((move + (key === "down" ? 1 : count - 1)) % count);
    }
    if (key === "up" || key === "down") {
      setIndex((index + (key === "down" ? 1 : list.length - 1)) % list.length);
      setMove(0);
    }
  });
  if (!creature) {
    return null;
  }
  const data = species(creature.species);
  const sprite = battleSprite(creature.species, { shiny: creature.shiny });
  const max = hp(creature);
  const next = creature.level < 100 ? Math.max(0, experience(creature.level + 1) - creature.exp) : 0;
  const profile = trainer.profile;
  const known = creature.moves[move] ? assets.moves[creature.moves[move].key] : null;
  return (
    <div className="gba-screen" role="dialog" aria-label={`${named(creature)} summary`}>
      <div className="gba-frame gba-summary">
        <div className="header">
          <span className="page">{pages[page]}</span>
          <span className="dots">
            {pages.map((name, i) => (
              <button key={name} aria-label={name} className={cn(i === page && "on")} onClick={() => setPage(i)} />
            ))}
          </span>
          <span className="hint">◀▶ PAGE · X CLOSE</span>
        </div>
        <div className="left">
          <div className="tag">
            <img src={iconOf("poke-ball")} alt="" draggable={false} />
            <b>{named(creature)}</b>
            <GenderMark creature={creature} />
            {creature.shiny ? <span className="shiny">★</span> : null}
          </div>
          <div className="level">Lv. {creature.level}</div>
          <div className="dome">
            <img
              key={`${creature.species}:${creature.shiny}`}
              src={creature.art || sprite.src}
              alt={data?.name}
              draggable={false}
              onError={(event) => (event.currentTarget.src = artwork(creature.species, { shiny: creature.shiny }))}
            />
          </div>
          <div className="item">
            <span>ITEM</span>
            {creature.held ? (
              <b>
                <img src={iconOf(creature.held)} alt="" draggable={false} />
                {items[creature.held].name}
              </b>
            ) : (
              <b>NONE</b>
            )}
          </div>
        </div>
        <div className="right">
          {page === 0 ? (
            <>
              <dl>
                <dt>Dex No.</dt>
                <dd>{String(creature.species).padStart(3, "0")}</dd>
                <dt>Species</dt>
                <dd>{data?.name}</dd>
                <dt>Type</dt>
                <dd className="types">
                  {data?.types.map((type) => (
                    <TypeTag key={type} type={type} />
                  ))}
                </dd>
                <dt>OT</dt>
                <dd className="ot">{profile?.name ?? "—"}</dd>
                <dt>ID No.</dt>
                <dd>{trainerId(profile?.name ?? "")}</dd>
                <dt>Condition</dt>
                <dd>{creature.status ? <StatusTag creature={creature} /> : creature.hp > 0 ? "OK" : "Fainted"}</dd>
              </dl>
              <p className="memo">
                {creature.nature ? `${natureLabel(creature.nature)} nature.` : "A calm, ordinary nature."} {friendshipText(creature)}
              </p>
            </>
          ) : page === 1 ? (
            <>
              <dl className="stats">
                <dt>HP</dt>
                <dd className="with-bar">
                  {creature.hp}/{max}
                  <HpBar creature={creature} />
                </dd>
                {statNames.slice(1).map((name, i) => (
                  <div key={name} className="row">
                    <dt>{name}</dt>
                    <dd>{stat(creature, i + 1)}</dd>
                  </div>
                ))}
                <dt>EXP. POINTS</dt>
                <dd>{creature.exp}</dd>
                <dt>NEXT LV.</dt>
                <dd>{next}</dd>
              </dl>
              <p className="memo">
                <b>{abilityName(abilityOf(creature)) || "No ability"}</b> {abilityAbout(abilityOf(creature))}
              </p>
            </>
          ) : (
            <>
              <ul className="moves">
                {creature.moves.map(({ key, pp }, i) => {
                  const info = assets.moves[key];
                  return (
                    <li key={key}>
                      <button className={cn(i === move && "picked")} onMouseEnter={() => setMove(i)} onClick={() => setMove(i)}>
                        <TypeTag type={info?.type ?? "normal"} />
                        <span className="move">{info?.name ?? key}</span>
                        <span className="pp">
                          PP {pp}/{info?.pp ?? "?"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {known ? (
                <div className="move-detail">
                  <span>POWER</span>
                  <b>{known.power || "—"}</b>
                  <span>ACCURACY</span>
                  <b>{known.accuracy >= 100 ? 100 : known.accuracy || "—"}</b>
                  <span>CATEGORY</span>
                  <b>{known.class.toUpperCase()}</b>
                  <p>{moveAbout(known)}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

//=================================================================================================
// Bag

/** What the bag is opened for: anything (from the menu), an item to use in battle, or one to give a Pokémon to hold */
export type BagOptions = { battle?: { usable: (id: ItemId) => boolean }; give?: boolean };

/** Open the bag, resolves with the item picked in battle or to give (null otherwise) */
export function bag(options: BagOptions = {}) {
  return openDialog<ItemId | null>((close) => <BagScreen options={options} close={close} />).then((value) => value ?? null);
}

/** What the bag says about using an item outside battles that has no USE */
const fieldUse: Partial<Record<Pocket | string, string>> = {
  rod: "Face the water and press Space to fish.",
  "vs-seeker": "Press V to use the VS Seeker.",
  hm: "No Pokémon has to learn it: face the obstacle and press Space.",
  ball: "Throw it at a wild Pokémon in battle.",
  hold: "Give it to a Pokémon to hold in battle.",
};

function BagScreen({ options, close }: { options: BagOptions; close: (value?: ItemId | null) => void }) {
  useSession();
  const [pocket, setPocket] = useState(0);
  const [cursors, setCursors] = useState<number[]>(pockets.map(() => 0));
  const [choices, setChoices] = useState<Choices | null>(null);
  const [message, setMessage] = useState("");
  const [away, setAway] = useState(false);
  const { id: pocketId, name: pocketName, frame } = pockets[pocket];
  const list = trainer.bag.filter(({ id }) => pocketOf(id) === pocketId);
  const cursor = Math.min(cursors[pocket], list.length);
  const current = list[cursor];
  const setCursor = (value: number) => setCursors(cursors.map((old, i) => (i === pocket ? value : old)));
  const open = async <T,>(screen: () => Promise<T>) => {
    setAway(true);
    const value = await screen();
    setAway(false);
    return value;
  };
  const pickItem = (id: ItemId) => {
    const item = items[id];
    setMessage("");
    if (options.give) {
      return item.kind === "hold" ? close(id) : setMessage("That can't be held.");
    }
    if (options.battle) {
      if (!options.battle.usable(id)) {
        return setMessage("That can't be used now.");
      }
      return setChoices({
        title: `${item.name} is selected.`,
        cursor: 0,
        options: [
          { label: "USE", run: () => close(id) },
          { label: "CANCEL", run: () => {} },
        ],
      });
    }
    //Used on a Pokémon (potions, cures, revives, Rare Candies, stones), used at once (Repels, the Exp. Share, Escape Ropes), or only checked
    const onPokemon = ["heal", "cure", "revive", "candy", "evolve"].includes(item.kind);
    const atOnce = ["repel", "rope", "key"].includes(item.kind);
    const use = async () => {
      if (item.kind === "rope") {
        if (!session.escape()) {
          return setMessage("You can't use that here.");
        }
        //Back outside, with every menu closed
        close(null);
        return closeMenu();
      }
      if (atOnce) {
        return setMessage(session.useItem(id));
      }
      const said = await open(async () => {
        const index = await party({ message: `Use the ${item.name} on which Pokémon?`, can: (creature) => helps(id, creature) || "It won't have any effect." });
        const creature = index === null ? null : trainer.profile?.party[index];
        return creature ? session.useOn(id, creature) : null;
      });
      if (said) {
        setMessage(said);
      }
    };
    setChoices({
      title: `${item.name} is selected.`,
      cursor: 0,
      options: [
        ...(onPokemon || atOnce
          ? [{ label: "USE", run: use }]
          : [{ label: "CHECK", run: () => setMessage(fieldUse[id] ?? fieldUse[item.kind] ?? item.about) }]),
        ...(item.kind === "hold"
          ? [
              {
                label: "GIVE",
                run: async () => {
                  const index = await open(() => party({ message: `Give the ${item.name} to which Pokémon?` }));
                  const creature = index === null ? null : trainer.profile?.party[index];
                  if (creature && session.hold(creature, id)) {
                    setMessage(`${named(creature)} was given the ${item.name} to hold.`);
                  }
                },
              },
            ]
          : []),
        { label: "CANCEL", run: () => {} },
      ],
    });
  };
  useKeys((key) => {
    if (choices) {
      return steer(choices, key, setChoices);
    }
    if (key === "b") {
      return close(null);
    }
    if (key === "left" || key === "right") {
      setMessage("");
      return setPocket((pocket + (key === "right" ? 1 : pockets.length - 1)) % pockets.length);
    }
    if (key === "up" || key === "down") {
      //The last line closes the bag
      return setCursor((cursor + (key === "down" ? 1 : list.length)) % (list.length + 1));
    }
    if (key === "a") {
      return current ? pickItem(current.id) : close(null);
    }
  }, !away);
  if (away) {
    return null;
  }
  const gender = girlish(trainer.profile?.sprite) ? "bag_female" : "bag_male";
  return (
    <div className="gba-screen" role="dialog" aria-label="Bag">
      <div className="gba-frame gba-bag">
        <div className="side">
          <div className="label">BAG</div>
          <div className="picture" style={{ backgroundImage: `url(/game/items/${gender}.png)`, backgroundPositionY: `${frame * 20}%` }} />
          <div className="pockets">
            <div className="tabs">
              <button aria-label="Previous pocket" onClick={() => setPocket((pocket + pockets.length - 1) % pockets.length)}>
                ◀
              </button>
              {pockets.map(({ id, name }, i) => (
                <span key={id} title={name} className={cn(i === pocket && "on")} onClick={() => setPocket(i)} />
              ))}
              <button aria-label="Next pocket" onClick={() => setPocket((pocket + 1) % pockets.length)}>
                ▶
              </button>
            </div>
            <div className="name">{pocketName}</div>
            <div className="caption">POCKET</div>
          </div>
        </div>
        <ul className="list">
          {list.map(({ id, count }, i) => (
            <li key={id}>
              <button
                className={cn(i === cursor && "picked")}
                onMouseEnter={() => !choices && setCursor(i)}
                onClick={() => !choices && (setCursor(i), pickItem(id))}
              >
                <span>{items[id].name}</span>
                <span className="count">× {count}</span>
              </button>
            </li>
          ))}
          <li>
            <button className={cn(cursor === list.length && "picked")} onMouseEnter={() => !choices && setCursor(list.length)} onClick={() => close(null)}>
              <span>CLOSE BAG</span>
            </button>
          </li>
        </ul>
        <div className="about">
          <span className="icon">{current ? <img src={iconOf(current.id)} alt="" draggable={false} /> : <b>↩</b>}</span>
          <p>{choices?.title ?? (message || (current ? items[current.id].about : list.length ? "Close the bag." : "This pocket is empty. Close the bag."))}</p>
        </div>
        {choices ? (
          <ChoiceBox choices={choices} onPoint={(i) => setChoices({ ...choices, cursor: i })} onPick={(i) => (setChoices(null), choices.options[i].run())} />
        ) : null}
      </div>
    </div>
  );
}
