import { Anim } from "./sprite";
import { Ledge, PixelButton, Sticker } from "./pixel";
import { edit } from "@/lib/api";

/** Twinkling stars over the night sky (percent positions, delay in seconds) */
const stars = [
  [6, 12, 0],
  [14, 34, 1.2],
  [23, 8, 0.6],
  [33, 26, 1.8],
  [44, 5, 0.3],
  [56, 18, 1.5],
  [64, 9, 0.9],
  [73, 30, 2.1],
  [81, 7, 0.4],
  [90, 22, 1.1],
  [96, 40, 1.7],
  [4, 52, 2.4],
  [38, 46, 0.8],
  [68, 48, 1.3],
];

/** Hero: night sky, a dreaming Musharna, the big sticker headline and towers on the ledge at both sides */
export function Hero() {
  return (
    <section className="relative overflow-x-clip">
      {/* The dream sky picture, darkened so the headline and buttons stay readable */}
      <div className="pixelated absolute inset-0 bg-[url(/site/herobg.avif)] bg-cover bg-[center_70%]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[linear-gradient(rgb(13_7_32/0.4)_0%,rgb(20_11_42/0.44)_25%,rgb(30_16_60/0.44)_100%)]" aria-hidden="true" />
      {stars.map(([x, y, delay]) => (
        <span
          key={`${x}-${y}`}
          className="twinkle absolute size-1 bg-white"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
          aria-hidden="true"
        />
      ))}

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-0 pt-12 text-center md:pt-16">
        <p className="font-pixel text-[30px] leading-none text-[#f06aa6] [text-shadow:4px_4px_0_#4a1640] sm:text-[44px]">DreamMist</p>
        <p className="mt-2 font-game text-[16px] text-[#c9b8f5]">Pokémon game maker</p>

        <div className="relative mt-6">
          <div className="absolute inset-x-6 bottom-4 top-10 rounded-full bg-[#f06aa6]/25 blur-3xl" aria-hidden="true" />
          <Anim id={518} w={77} h={74} scale={3} className="float relative h-auto w-52 sm:w-64" />
        </div>

        <h1 className="relative -mt-6 flex flex-col items-center gap-3">
          <Sticker className="text-[30px] sm:text-[48px]">Build your own</Sticker>
          <span className="font-pixel text-[30px] leading-tight text-white [text-shadow:4px_4px_0_#0b0616] sm:text-[48px]">Pokémon game.</span>
        </h1>
        <p className="mt-5 max-w-[46ch] text-balance font-game text-[16px] leading-relaxed text-[#e8e3f7]">
          Towns and routes, a story, trainers, gyms and battles. Make the whole adventure, then let your friends play it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <PixelButton href={edit()}>Start making</PixelButton>
          <PixelButton href="/explore" tone="lilac">
            Play games
          </PixelButton>
        </div>
        <p className="mt-5 font-game text-[13px] text-[#e8e3f7]">Free, in your browser, no download and no code.</p>
      </div>

      {/* Towers on the ledge, two at each side: the middle stays clear for the headline and buttons */}
      {/* They stand on the ledge's middle line (it's 40px tall, the line at 23px), over the ledge */}
      <div className="pointer-events-none relative z-10 mt-10 h-36 sm:h-32" aria-hidden="true">
        <div className="absolute -bottom-[23px] right-[calc(50%+140px)] flex items-end gap-2 sm:right-[calc(50%+440px)] sm:gap-6">
          <img src="/site/tower.avif" alt="" className="h-[110px] w-auto max-w-none sm:h-[250px]" />
          <img src="/site/tower2.avif" alt="" className="h-[150px] w-auto max-w-none sm:h-[350px]" />
        </div>
        <div className="absolute -bottom-[23px] left-[calc(50%+140px)] flex items-end gap-2 sm:left-[calc(50%+440px)] sm:gap-6">
          <img src="/site/tower3.avif" alt="" className="h-[160px] w-auto max-w-none sm:h-[370px]" />
          <img src="/site/tower4.avif" alt="" className="h-[140px] w-auto max-w-none sm:h-[330px]" />
        </div>
      </div>
      <Ledge className="relative" />
    </section>
  );
}
