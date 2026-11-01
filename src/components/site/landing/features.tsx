import type { ReactNode } from "react";
import { Heading, Pink } from "./sprite";
import { cn } from "@/lib/utils";

/** Real numbers from the game data */
const stats = [
  { value: "1,025", label: "Pokémon" },
  { value: "6,328", label: "Hoenn tiles" },
  { value: "60", label: "real towns and routes" },
  { value: "40", label: "maps in one town" },
];

/** Feature card: a chunky game panel with the map in its own window and the games' location sign */
function Feature({
  number,
  accent,
  title,
  children,
  image,
  place,
}: {
  number: number;
  accent: string;
  title: string;
  children: ReactNode;
  image: string;
  place: string;
}) {
  return (
    <article className="group flex flex-col border-4 border-[#0b0616] bg-[#1d1038] shadow-[inset_0_4px_0_#3f2c74,6px_6px_0_#0b0616] transition-[translate,box-shadow] duration-150 ease-[steps(3)] hover:-translate-y-1 hover:shadow-[inset_0_4px_0_#3f2c74,8px_10px_0_#0b0616]">
      <div className="h-1.5" style={{ background: accent }} aria-hidden="true" />
      <div className="p-3 pb-0">
        <div className="relative aspect-[4/3] overflow-hidden border-4 border-[#0b0616]">
          <img
            src={image}
            alt={`${place} built with the DreamMist editor`}
            className="pixelated h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute bottom-2 left-2 border-[3px] border-[#5a3a20] bg-[#f4e2b0] px-2 py-0.5 font-game text-[13px] font-bold text-[#4a3018] shadow-[2px_2px_0_rgb(0_0_0/0.4)]">
            {place}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="font-pixel text-[11px]" style={{ color: accent }}>
          No. 0{number}
        </span>
        <h3 className="mt-1.5 text-balance font-pixel text-[16px] leading-snug text-white">{title}</h3>
        <p className="mt-2 font-game text-[15px] leading-relaxed text-[#c9b8f5]">{children}</p>
      </div>
    </article>
  );
}

/** Everything else: feature cards and stats */
export function Features() {
  return (
    <section className="px-4 py-20">
      <Heading lead="No code, all in your browser">
        Everything a <Pink>Pokémon game</Pink> needs.
      </Heading>
      <div className="mx-auto mt-14 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Feature number={1} accent="#f06aa6" title="Paint real Hoenn tiles" image="/site/maps/petalburg-city.png" place="Petalburg City">
          Houses, Pokémon Centers and trees, terrains that draw their own borders, or your own tileset.
        </Feature>
        <Feature number={2} accent="#b9a6ff" title="Join routes and towns" image="/site/maps/rustboro-city.png" place="Rustboro City">
          Put routes and other towns side by side, and walk from one to the next across their edges.
        </Feature>
        <Feature number={3} accent="#5ee07a" title="Start from real places" image="/site/maps/fortree-city.png" place="Fortree City">
          Begin from any of the 60 towns and routes of Hoenn, or from a blank field.
        </Feature>
        <Feature number={4} accent="#6db6ff" title="Build with friends" image="/site/maps/littleroot-town.png" place="Littleroot Town">
          Share an invite link and build the same town at the same time, then publish it to Explore.
        </Feature>
      </div>
      <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-y-8 md:grid-cols-4">
        {stats.map(({ value, label }, i) => (
          <div key={label} className={cn("px-4 text-center", i && "md:border-l-2 md:border-dashed md:border-[#3f2c74]")}>
            <dt className="font-game text-[14px] text-[#9b8cc9]">{label}</dt>
            <dd className="mt-1 font-pixel text-[26px] text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
