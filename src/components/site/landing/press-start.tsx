import { Cloud, PixelButton, Sticker } from "./pixel";
import { Anim } from "./sprite";
import { edit } from "@/lib/api";

/** Closing call to action over a giant "press start" */
export function PressStart() {
  return (
    <section className="relative isolate px-4 py-32">
      {/* Moonlit sky (anchored left and scaled up so the moon sits beside the headline, not behind it), fading into the page above */}
      <div
        className="pixelated absolute inset-0 -z-10 bg-[url(/site/bg2.avif)] bg-[length:max(130%,1100px)_auto] bg-[position:0%_25%] bg-no-repeat"
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-10 bg-black/50" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(#140b26_0%,rgb(20_11_38/0.3)_25%,rgb(20_11_38/0.3)_80%,#140b26_100%)]" aria-hidden="true" />
      <p
        className="pointer-events-none absolute inset-x-0 top-6 select-none text-center font-pixel text-[64px] leading-none text-white/[0.8] sm:text-[140px]"
        aria-hidden="true"
      >
        Press start
      </p>
      <Cloud className="absolute -left-10 bottom-10 w-80 opacity-70" />
      <Cloud flip className="absolute -right-10 top-16 w-72 opacity-70" />
      <div className="relative flex flex-col items-center text-center">
        <Anim id={517} w={45} h={43} scale={3} className="float h-auto w-28" />
        <h2 className="mt-4 flex flex-col items-center gap-3">
          <Sticker className="text-[26px] sm:text-[40px]">Your dream town</Sticker>
          <span className="font-pixel text-[26px] text-white [text-shadow:4px_4px_0_#0b0616] sm:text-[40px]">is waiting.</span>
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <PixelButton href={edit()}>Start building</PixelButton>
          <PixelButton href="/docs/first-game" tone="lilac">
            Make your first game
          </PixelButton>
        </div>
      </div>
    </section>
  );
}
