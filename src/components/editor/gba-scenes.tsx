"use client";

/**
 * Scenes drawn like the Game Boy Advance games: the new game's opening with the Professor, choosing a starter
 * from the Professor's bag, the naming screen, and the evolution screen.
 * Like the other GBA screens, the keyboard drives them: arrows (or WASD) move, Z, Space, Enter or E pick, X or Escape go back.
 */

import { openDialog } from "@/components/editor/dialogs";
import { girlish, type Key, TypeTag, useKeys, useTyping } from "@/components/editor/gba-screens";
import { artwork, species } from "@/game/assets";
import { sound } from "@/game/audio";
import { cloud } from "@/game/cloud";
import { session } from "@/game/session";
import { type Creature, named, starters, trainer } from "@/game/trainer";
import type { Opening } from "@/game/ui-bridge";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

//=================================================================================================
// Text box and menus of a scene

/** What a scene shows at the bottom: a line of text (written letter by letter), and a menu beside it */
type Talk = { text: string; shown: number; menu: { options: string[]; cursor: number; back?: number } | null };

/**
 * Split a page into pages of at most two lines, the most the text box holds (like the games, a long sentence goes on after A).
 * Measured in a hidden copy of the box inside the open scene, so the font and the screen's size are the real ones
 */
async function fit(page: string) {
  const frames = document.querySelectorAll(".gba-screen .gba-frame");
  const frame = frames[frames.length - 1];
  if (!frame) {
    return [page];
  }
  await document.fonts?.ready;
  const box = frame.appendChild(Object.assign(document.createElement("div"), { className: "gba-text" }));
  box.style.visibility = "hidden";
  box.setAttribute("aria-hidden", "true");
  const p = box.appendChild(document.createElement("p"));
  p.textContent = "A";
  const most = 2 * p.offsetHeight + 1;
  const fits = (text: string) => ((p.textContent = text), p.offsetHeight <= most);
  const pages = [] as string[];
  let current = "";
  for (const word of page.split(/ +/)) {
    const longer = current ? `${current} ${word}` : word;
    if (current && !fits(longer)) {
      pages.push(current);
      current = word;
    } else {
      current = longer;
    }
  }
  box.remove();
  return current ? [...pages, current] : pages;
}

/**
 * A scene's text box, driven by a script: `say` writes a page and waits for A, `pick` waits for a menu choice.
 * A shows a page at once while it's being written
 */
function useTalk(onKey?: (key: Key) => boolean) {
  const [talk, setTalk] = useState<Talk | null>(null);
  const next = useRef<null | ((value: number) => void)>(null);
  //Letters appear one by one
  useEffect(() => {
    if (!talk || talk.shown >= talk.text.length) {
      return;
    }
    const timer = setTimeout(() => setTalk((now) => now && { ...now, shown: now.shown + 1 }), 18);
    return () => clearTimeout(timer);
  }, [talk]);
  useKeys((key) => {
    if (onKey?.(key) || !talk) {
      return;
    }
    if (talk.shown < talk.text.length) {
      return key === "a" || key === "b" ? setTalk({ ...talk, shown: talk.text.length }) : undefined;
    }
    const { menu } = talk;
    if (menu) {
      const count = menu.options.length;
      if (key === "up" || key === "down") {
        setTalk({ ...talk, menu: { ...menu, cursor: (menu.cursor + (key === "down" ? 1 : count - 1)) % count } });
      } else if (key === "a" || (key === "b" && menu.back !== undefined)) {
        next.current?.(key === "a" ? menu.cursor : menu.back!);
      }
    } else if (key === "a" || key === "b") {
      next.current?.(0);
    }
  });
  //The script's calls stay the same from one render to the next
  const [calls] = useState(() => {
    const wait = <T,>(state: Talk) =>
      new Promise<T>((solve) => {
        setTalk(state);
        next.current = (value) => {
          next.current = null;
          solve(value as T);
        };
      });
    return {
      /** Write a text (blank lines split pages, and pages too long for the box go on over more), each page waiting for A */
      say: async (text: string) => {
        for (const page of text.split(/\n\s*\n/).filter((page) => page.trim())) {
          for (const part of await fit(page.trim())) {
            await wait<void>({ text: part, shown: 0, menu: null });
          }
        }
      },
      /** Ask with a menu (`back` is the answer B gives); a question too long for the box is said first, its last page asked */
      pick: async (text: string, options: string[], back?: number) => {
        const parts = await fit(text);
        for (const part of parts.slice(0, -1)) {
          await wait<void>({ text: part, shown: 0, menu: null });
        }
        return wait<number>({ text: parts[parts.length - 1] ?? text, shown: 0, menu: { options, cursor: 0, back } });
      },
      /** A menu entry was clicked */
      choose: (index: number) => next.current?.(index),
      /** Empty the text box */
      clear: () => setTalk(null),
    };
  });
  /** Tapping the text box does what A does: shows the whole page, or goes on (menus are tapped themselves) */
  const tap = () => {
    if (talk && talk.shown < talk.text.length) {
      setTalk({ ...talk, shown: talk.text.length });
    } else if (talk && !talk.menu) {
      next.current?.(0);
    }
  };
  return { talk, tap, ...calls };
}

/** The text box of a scene, with its menu */
function TextBox({ talk, onChoose, onTap }: { talk: Talk | null; onChoose: (index: number) => void; onTap?: () => void }) {
  if (!talk) {
    return null;
  }
  const done = talk.shown >= talk.text.length;
  return (
    <>
      <div className="gba-text" aria-live="polite" onClick={onTap}>
        <p>{talk.text.slice(0, talk.shown)}</p>
        {done && !talk.menu ? <span className="more" aria-hidden="true" /> : null}
      </div>
      {done && talk.menu ? (
        <div className="gba-choices scene" role="menu">
          {talk.menu.options.map((label, i) => (
            <button key={label} role="menuitem" className={cn(i === talk.menu!.cursor && "picked")} onClick={() => onChoose(i)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

//=================================================================================================
// New game

/** What the Professor says when a game has no speech of its own */
function welcome(game: string) {
  return [
    "Hi! Sorry to keep you waiting!",
    "Welcome to the world of Pokémon! I'm Professor Birch.",
    "This world is full of creatures called Pokémon. People live and travel with them: some play together, some battle together.",
    `And this is ${game}. All kinds of Pokémon are waiting for you out there.`,
  ].join("\n\n");
}

/** The new game's opening: the Professor's speech, then a new trainer picks their look, their name and (when the game gives none) a partner */
export function opening(options: Opening) {
  return openDialog<void>((close) => <OpeningScene options={options} close={close} />).then(() => undefined);
}

function OpeningScene({ options, close }: { options: Opening; close: () => void }) {
  const { talk, tap, say, pick, choose } = useTalk();
  //Who stands on the platform: the Professor, then the player as they choose
  const [stage, setStage] = useState<"professor" | "brendan" | "may" | "">("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    void (async () => {
      setStage("professor");
      await say(options.speech?.trim() || welcome(options.game));
      if (options.newTrainer) {
        let name = "";
        let look = "em_brendan";
        for (;;) {
          await say("Now, tell me a little about yourself.");
          setStage("brendan");
          const girl = await pick("Are you a boy? Or are you a girl?", ["BOY", "GIRL"]);
          look = girl ? "em_may" : "em_brendan";
          setStage(girl ? "may" : "brendan");
          await say("All right.");
          name =
            (await nameScreen("Your name?", { initial: cloud.user?.username ?? "", player: girl ? "may" : "brendan" })).trim().slice(0, 16) ||
            (girl ? "May" : "Brendan");
          if ((await pick(`So it's ${name}?`, ["YES", "NO"], 1)) === 0) {
            break;
          }
        }
        session.startTrainer(name, look);
      }
      //A partner from the Professor's bag, when the game has no starter to choose
      const name = trainer.profile?.name ?? "Trainer";
      if (options.partner) {
        setStage("professor");
        await say(`${name}, you'll need a Pokémon by your side out there.\n\nTake one from my bag!`);
        const partner = starters[await starterScreen(starters, { message: "Choose a Pokémon to be your partner." })] ?? starters[0];
        session.givePartner(partner);
        sound.jingle("victory");
        await say(`${name} received ${species(partner).name}!`);
      }
      //A game that hands out its own starter: tell them to go and get it
      if (!trainer.profile?.party.length && !trainer.profile?.box.length) {
        setStage("professor");
        await say("You don't have any Pokémon yet, do you?\n\nDon't worry: your first partner is waiting for you in town!");
      }
      setStage(girlish(trainer.profile?.sprite) ? "may" : "brendan");
      await say(`${name}! Your very own Pokémon adventure is about to unfold!\n\nA world of dreams and adventures with Pokémon awaits! Let's go!`);
      close();
    })();
  }, [options, close, pick, say]);
  //While choosing BOY or GIRL, the one pointed at stands there
  const shown = talk?.menu?.options[0] === "BOY" ? (talk.menu.cursor ? "may" : "brendan") : stage;
  return (
    <div className="gba-screen gba-full" role="dialog" aria-label="New game">
      <div className="gba-frame gba-opening">
        <div className="stage">
          {shown ? <img key={shown} className="who" src={`/game/intro/${shown === "professor" ? "birch" : shown}.png`} alt="" draggable={false} /> : null}
          <div className="platform" aria-hidden="true" />
        </div>
        <TextBox talk={talk} onChoose={choose} onTap={tap} />
      </div>
    </div>
  );
}

//=================================================================================================
// The Professor's bag

/** Choose one of a few Pokémon from the Professor's bag: resolves with its index (there's no way out) */
export function starterScreen(choices: number[], { message = "Choose a Pokémon." } = {}) {
  return openDialog<number>((close) => <StarterScene choices={choices} message={message} close={close} />).then((index) => index ?? 0);
}

function StarterScene({ choices, message, close }: { choices: number[]; message: string; close: (index: number) => void }) {
  const [cursor, setCursor] = useState(Math.floor((choices.length - 1) / 2));
  //Busy while its first message shows or a choice is asked: the text box hears the keys then
  const asking = useRef(true);
  const { talk, tap, say, pick, choose, clear } = useTalk((key) => {
    //Pointing at the balls while nothing is being asked
    if (asking.current) {
      return false;
    }
    if (key === "left" || key === "right") {
      setCursor((cursor + (key === "right" ? 1 : choices.length - 1)) % choices.length);
    } else if (key === "a") {
      void choosing(cursor);
    }
    return true;
  });
  async function choosing(index: number) {
    if (asking.current) {
      return;
    }
    asking.current = true;
    setCursor(index);
    const yes = (await pick(`Do you choose this Pokémon, ${species(choices[index]).name}?`, ["YES", "NO"], 1)) === 0;
    asking.current = false;
    if (yes) {
      close(index);
    } else {
      clear();
    }
  }
  useEffect(() => {
    void say(message).then(() => {
      clear();
      asking.current = false;
    });
  }, [message, say, clear]);
  const current = species(choices[cursor]);
  return (
    <div className="gba-screen" role="dialog" aria-label="Choose a Pokémon">
      <div className="gba-frame gba-starter">
        <div className="bubble">
          <img src={artwork(current.id)} alt={current.name} draggable={false} />
        </div>
        <div className="about">
          <b>{current.name.toUpperCase()}</b>
          <span>
            {current.types.map((type) => (
              <TypeTag key={type} type={type} />
            ))}
          </span>
        </div>
        <div className="balls">
          {choices.map((id, i) => (
            <button
              key={id}
              className={cn("ball", i === cursor && "picked")}
              aria-label={species(id).name}
              onMouseEnter={() => !asking.current && setCursor(i)}
              onClick={() => void choosing(i)}
            />
          ))}
        </div>
        <div className="bag" aria-hidden="true" />
        <TextBox talk={talk ?? { text: "Use ◀ ▶ to look, then pick one.", shown: 99, menu: null }} onChoose={choose} onTap={tap} />
      </div>
    </div>
  );
}

//=================================================================================================
// Naming screen

/** Name someone (a new trainer, a Pokémon just caught): resolves with the name typed (empty when B) */
export function nameScreen(title: string, { initial = "", creature, player }: { initial?: string; creature?: Creature; player?: string } = {}) {
  return openDialog<string>((close) => <NameScene title={title} initial={initial} creature={creature} player={player} close={close} />).then(
    (name) => name ?? "",
  );
}

function NameScene({
  title,
  initial,
  creature,
  player,
  close,
}: {
  title: string;
  initial: string;
  creature?: Creature;
  player?: string;
  close: (name: string) => void;
}) {
  useTyping();
  const max = creature ? 12 : 16;
  const [name, setName] = useState(initial.slice(0, max));
  return (
    <div className="gba-screen" role="dialog" aria-label={title}>
      <form
        className="gba-frame gba-naming"
        onSubmit={(event) => {
          event.preventDefault();
          close(name.trim());
        }}
      >
        <div className="head">
          {creature ? (
            <img src={artwork(creature.species, { shiny: creature.shiny })} alt="" draggable={false} />
          ) : player ? (
            <img src={`/game/intro/${player}.png`} alt="" draggable={false} />
          ) : null}
          <b>{title.toUpperCase()}</b>
        </div>
        <label className="field">
          <span className="sr-only">{title}</span>
          <input
            autoFocus
            value={name}
            maxLength={max}
            spellCheck={false}
            autoComplete="off"
            placeholder={creature ? species(creature.species).name : ""}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && close("")}
          />
          <span className="slots" aria-hidden="true">
            {Array.from({ length: max }, (_, i) => (
              <i key={i} className={cn(i === name.length && "at")} />
            ))}
          </span>
        </label>
        <p className="hint">Type a name, then press Enter. Esc keeps {creature ? `the name ${named(creature)}` : "the usual name"}.</p>
        <div className="buttons">
          <button type="button" onClick={() => close("")}>
            BACK
          </button>
          <button type="submit">OK</button>
        </div>
      </form>
    </div>
  );
}

//=================================================================================================
// Evolution

/** The evolution screen: resolves false when the player stopped it with B (only when `cancel`) */
export function evolutionScreen(creature: Creature, into: number, { cancel }: { cancel: boolean }) {
  return openDialog<boolean>((close) => <EvolutionScene creature={creature} into={into} cancel={cancel} close={close} />).then(Boolean);
}

function EvolutionScene({ creature, into, cancel, close }: { creature: Creature; into: number; cancel: boolean; close: (evolved: boolean) => void }) {
  const name = named(creature);
  const [phase, setPhase] = useState<"start" | "glow" | "done" | "stopped">("start");
  //Which form shows while it glows (they swap faster and faster)
  const [after, setAfter] = useState(false);
  const stopped = useRef(false);
  const { talk, tap, say, choose } = useTalk((key) => {
    if (key === "b" && cancel && phase === "glow") {
      stopped.current = true;
      return true;
    }
    return phase === "glow";
  });
  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise((solve) => setTimeout(solve, ms));
    void (async () => {
      await say(`What? ${name} is evolving!`);
      setPhase("glow");
      //Swap between the two forms, faster and faster, unless B stops it
      for (let gap = 520; gap > 40 && !stopped.current; gap *= 0.84) {
        await sleep(gap);
        if (!alive) return;
        setAfter((now) => !now);
      }
      if (stopped.current) {
        setAfter(false);
        setPhase("stopped");
        await say(`Huh? ${name} stopped evolving!`);
        return close(false);
      }
      setAfter(true);
      setPhase("done");
      sound.jingle("victory");
      await say(`Congratulations! Your ${name} evolved into ${species(into).name}!`);
      close(true);
    })();
    return () => {
      alive = false;
    };
  }, [close, into, name, say]);
  const shown = after ? into : creature.species;
  return (
    <div className="gba-screen" role="dialog" aria-label="Evolution">
      <div className={cn("gba-frame gba-evolution", phase)}>
        <div className="sparkles" aria-hidden="true" />
        <img className={cn("form", phase === "glow" && "lit")} src={artwork(shown, { shiny: creature.shiny })} alt={species(shown).name} draggable={false} />
        {phase === "glow" && cancel ? (
          <button className="stop" onClick={() => (stopped.current = true)}>
            B: stop evolving
          </button>
        ) : null}
        <TextBox talk={talk} onChoose={choose} onTap={tap} />
      </div>
    </div>
  );
}
