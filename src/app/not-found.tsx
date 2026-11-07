import { PixelButton } from "@/components/site/landing/pixel";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

/** 404: a wild nothing appeared */
export default function NotFound() {
  return (
    <main className="night grid min-h-dvh place-items-center px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/site/sprites/anim-517.gif" alt="" width={45} height={43} className="pixelated float h-auto w-24" />
        <p className="font-pixel text-[44px] leading-none text-[#f06aa6] sm:text-[64px]">404</p>
        <h1 className="font-pixel text-[18px] text-white sm:text-[22px]">This route isn&apos;t on the map</h1>
        <p className="max-w-[44ch] font-game text-[16px] text-[#c9b8f5]">The page you followed doesn&apos;t exist, or it moved somewhere else.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <PixelButton href="/">Go home</PixelButton>
          <PixelButton href="/explore" tone="lilac">
            Explore games
          </PixelButton>
        </div>
      </div>
    </main>
  );
}
