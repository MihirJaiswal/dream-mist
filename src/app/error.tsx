"use client";

import { PixelButton } from "@/components/site/landing/pixel";
import { useEffect } from "react";

/** Something broke while rendering a page: say so, and offer to try again */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="night grid min-h-dvh place-items-center px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/site/sprites/anim-517.gif" alt="" width={45} height={43} className="pixelated float h-auto w-24" />
        <h1 className="font-pixel text-[20px] text-white sm:text-[26px]">Something went wrong</h1>
        <p className="max-w-[44ch] font-game text-[16px] text-[#c9b8f5]">
          This page hit an error. Trying again usually works{error.digest ? ` (code ${error.digest})` : ""}.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="pixel-button pixel-button-pink">
            <span>Try again</span>
          </button>
          <PixelButton href="/" tone="lilac">
            Go home
          </PixelButton>
        </div>
      </div>
    </main>
  );
}
