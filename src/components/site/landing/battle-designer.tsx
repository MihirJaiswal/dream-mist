"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, useState } from "react";
import { Dialogue } from "./dialogue";
import { PixelButton } from "./pixel";
import { Heading, Pink, sprite } from "./sprite";

/** Gen 3 back sprite, for the player's Pokémon */
const back = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/ruby-sapphire/back/${id}.png`;

/** Trainers to start from: their team (national Pokédex numbers and levels) and what they say sending out their last Pokémon */
const trainers = [
  {
    name: "Hiker Dale",
    accent: "#e0c068",
    team: [
      { id: 74, level: 14 },
      { id: 299, level: 15 },
      { id: 304, level: 16 },
    ],
    line: "These rocks have stood for ages. So will my team!",
  },
  {
    name: "Swimmer Nia",
    accent: "#6890f0",
    team: [
      { id: 270, level: 24 },
      { id: 318, level: 25 },
      { id: 341, level: 26 },
      { id: 350, level: 28 },
    ],
    line: "The tide is turning. Can you feel it?",
  },
  {
    name: "Leader Vex",
    accent: "#f06aa6",
    team: [
      { id: 302, level: 38 },
      { id: 359, level: 39 },
      { id: 354, level: 40 },
      { id: 334, level: 41 },
      { id: 373, level: 43 },
      { id: 376, level: 45 },
    ],
    line: "You've pushed me this far... Now see what I've been saving!",
  },
];

/** Weather over the scene, moving the way the games draw it (styles in globals.css) */
const weathers = [
  { key: "clear", label: "Clear", overlay: "" },
  { key: "rain", label: "Rain", overlay: "weather-rain" },
  { key: "sand", label: "Sandstorm", overlay: "weather-sand" },
  { key: "snow", label: "Snow", overlay: "weather-snow" },
];

/** A few of the Emerald battle scenes */
const scenes = [
  { key: "tall_grass", label: "Grass" },
  { key: "rock", label: "Mountain" },
  { key: "water", label: "Sea" },
  { key: "cave", label: "Cave" },
  { key: "sky", label: "Sky" },
  { key: "stadium", label: "Stadium" },
];

/** How the trainer picks moves */
const levels = [
  { key: "easy", label: "Easy", hint: "Picks moves at random." },
  { key: "normal", label: "Normal", hint: "Favors strong moves of its own type." },
  { key: "hard", label: "Hard", hint: "Always uses the move that hurts most." },
];

/** Centers of the 64×64 Pokémon sprites on the 240×112 battle scene (single, then double), as in Emerald */
const foeSpots = [
  [[176, 40]],
  [
    [148, 38],
    [204, 42],
  ],
];
const allySpots = [
  [[72, 80]],
  [
    [44, 80],
    [100, 84],
  ],
];

/** Place a sprite by its center on the scene, in percentages so it scales with it */
const place = ([x, y]: number[]) => ({
  left: `${((x - 32) / 240) * 100}%`,
  top: `${((y - 32) / 112) * 100}%`,
  width: `${(64 / 240) * 100}%`,
});

/** A labeled row of pixel toggle buttons */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { key: T; label: ReactNode }[];
  onChange: (key: T) => void;
  hint?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="font-pixel text-[10px] text-[#8f7fc0]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            role="radio"
            aria-checked={value === option.key}
            onClick={() => onChange(option.key)}
            className={cn(
              "border-[3px] px-3 py-1.5 font-game text-[14px] transition-colors duration-150 ease-[steps(2)]",
              value === option.key
                ? "border-[#0b0616] bg-[#f06aa6] text-[#1a0b2e] shadow-[3px_3px_0_#0b0616]"
                : "border-[#3f2c74] bg-[#140a2a] text-[#c9b8f5] hover:border-[#8f7fc0]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint ? <p className="mt-1.5 font-game text-[13px] text-[#8f7fc0]">{hint}</p> : null}
    </div>
  );
}

/** Battles: a small version of the editor's battle designer to play with */
export function BattleDesigner() {
  const [who, setWho] = useState(2);
  const [double, setDouble] = useState("single");
  const [weather, setWeather] = useState("clear");
  const [scene, setScene] = useState("stadium");
  const [level, setLevel] = useState("hard");
  const trainer = trainers[who];
  const foes = trainer.team.slice(-(double === "double" ? 2 : 1));
  const overlay = weathers.find(({ key }) => key === weather)!.overlay;

  return (
    <section className="px-4 py-20">
      <Heading lead="Every trainer in your game fights the way you want">
        Design your own <Pink>battles.</Pink>
      </Heading>
      <p className="mx-auto mt-5 max-w-[54ch] text-center font-game text-[16px] leading-relaxed text-[#c9b8f5]">
        Pick their team, the scene, the weather and how smart they are. Try it here, then do it for real in the editor.
      </p>

      <div className="mx-auto mt-12 grid max-w-7xl border-4 border-[#0b0616] bg-[#1d1038] shadow-[inset_0_4px_0_#3f2c74,6px_6px_0_#0b0616] lg:grid-cols-[1.25fr_1fr]">
        {/* The battle as it will look */}
        <div className="flex flex-col justify-center p-3 lg:pr-0">
          <div className="relative aspect-[240/112] overflow-hidden border-4 border-[#0b0616] bg-[#0e0820]" aria-hidden="true">
            <img src={`/game/battle/${scene}.png`} alt="" className="pixelated absolute inset-0 size-full object-cover" />
            {overlay ? <div className={cn("pointer-events-none absolute inset-0", overlay)} /> : null}
            {/* Their Pokémon on the far platform, yours with its back turned on the near one, where Emerald draws them */}
            {foes.map(({ id }, i) => (
              <img key={id} src={sprite(id)} alt="" width={64} height={64} className="pixelated absolute" style={place(foeSpots[foes.length - 1][i])} />
            ))}
            {(double === "double" ? [258, 252] : [258]).map((id, i, all) => (
              <img key={id} src={back(id)} alt="" width={64} height={64} className="pixelated absolute" style={place(allySpots[all.length - 1][i])} />
            ))}
            <span className="absolute left-2 top-2 border-[3px] border-[#5a3a20] bg-[#f4e2b0] px-2 py-0.5 font-game text-[12px] font-bold text-[#4a3018] shadow-[2px_2px_0_rgb(0_0_0/0.4)] sm:text-[13px]">
              {trainer.name} · {levels.find(({ key }) => key === level)!.label}
            </span>
          </div>
          {/* Over the bottom of the scene like the games' text box: Gen 3 back sprites are cut off at the bottom, hidden behind it */}
          <Dialogue key={who} className="z-10 mx-1 -mt-6 sm:mx-2 sm:-mt-8" speaker={trainer.name} pages={[trainer.line]} />
          {/* Their whole team, in the order they send it out */}
          <ol className="mt-3 grid grid-cols-6 gap-2" aria-label={`${trainer.name}'s team`}>
            {Array.from({ length: 6 }, (_, i) => trainer.team[i]).map((member, i) => (
              <li
                key={member ? `${who}-${member.id}` : `empty-${i}`}
                className="stepped grid aspect-square place-items-center bg-[#140a2a] shadow-[inset_0_0_0_3px_#3f2c74]"
              >
                {member ? (
                  <span className="grid place-items-center">
                    <img src={sprite(member.id)} alt="" width={64} height={64} className="pixelated size-10 sm:size-14" />
                    <span className="-mt-1 font-game text-[12px] text-[#c9b8f5]">Lv{member.level}</span>
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        {/* The choices */}
        <div className="grid content-start gap-6 p-5 sm:p-6">
          <div role="radiogroup" aria-label="Trainer">
            <p className="font-pixel text-[10px] text-[#8f7fc0]">Trainer</p>
            <div className="mt-2 grid gap-2">
              {trainers.map((t, i) => (
                <button
                  key={t.name}
                  role="radio"
                  aria-checked={who === i}
                  aria-label={t.name}
                  onClick={() => setWho(i)}
                  className={cn(
                    "flex items-center gap-3 border-[3px] px-3 py-2 text-left transition-colors duration-150 ease-[steps(2)]",
                    who === i ? "border-[#0b0616] bg-[#2a1850] shadow-[3px_3px_0_#0b0616]" : "border-[#3f2c74] bg-[#140a2a] hover:border-[#8f7fc0]",
                  )}
                >
                  <span className="size-3 shrink-0" style={{ background: t.accent }} />
                  <span className="w-28 shrink-0 font-game text-[14px] text-white">{t.name}</span>
                  <span className="flex min-w-0 flex-1 justify-end">
                    {t.team.map(({ id }, n) => (
                      <img
                        key={id}
                        src={sprite(id)}
                        alt=""
                        width={64}
                        height={64}
                        className={cn("pixelated -my-2 size-9 shrink-0", n > 2 && "hidden sm:block")}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Choice
            label="Battle style"
            value={double}
            onChange={setDouble}
            options={[
              { key: "single", label: "Single" },
              { key: "double", label: "Double" },
            ]}
          />
          <Choice label="Weather" value={weather} onChange={setWeather} options={weathers} />
          <Choice label="Scene" value={scene} onChange={setScene} options={scenes} />
          <Choice label="How they battle" value={level} onChange={setLevel} options={levels} hint={levels.find(({ key }) => key === level)!.hint} />
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[60ch] flex-col items-center gap-5 text-center">
        <p className="font-game text-[15px] leading-relaxed text-[#c9b8f5]">
          In the editor you also choose every Pokémon&apos;s moves, nature and held item, write what they say when they&apos;re low on HP, ban items, and play a
          test battle without leaving the map.
        </p>
        <PixelButton href="/editor" small>
          Design a battle
        </PixelButton>
      </div>
    </section>
  );
}
