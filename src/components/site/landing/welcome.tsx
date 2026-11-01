import { Dialogue } from "./dialogue";

/** The Professor welcomes you, under the ledge */
export function Welcome() {
  return (
    <section className="border-b-[3px] border-[#2d1a52] bg-[#1d1038] px-4 py-10">
      <div className="mx-auto flex max-w-3xl items-stretch gap-4">
        <div className="stepped hidden shrink-0 bg-[#b9a6ff] p-[3px] sm:block" aria-hidden="true">
          <div className="stepped grid h-[136px] w-[112px] place-items-end justify-center bg-[linear-gradient(#f8f0d8_60%,#d8e8a8_60%)] pb-2">
            <img src="/site/professor.avif" alt="" width={14} height={20} className="pixelated h-[120px] w-auto" />
          </div>
        </div>
        <Dialogue
          className="min-w-0 flex-1"
          speaker="Professor"
          pages={[
            "Welcome to the world of DreamMist!",
            "Here, you build the town: the routes, the tall grass, the gym and the story.",
            "Then your friends walk in and live the adventure you made. Ready?",
          ]}
        />
      </div>
    </section>
  );
}
