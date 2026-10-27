"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/**
 * Gen 3 style dialogue box that types its pages out one character at a time.
 * Click (or wait) to go to the next page. Screen readers get every page at once.
 */
export function Dialogue({ speaker, pages, className }: { speaker: string; pages: string[]; className?: string }) {
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const text = pages[page];
  const done = shown >= text.length;

  //Type the current page, or show it at once when motion is reduced
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const timer = setInterval(() => setShown((n) => n >= text.length ? (clearInterval(timer), n) : n + 1), 32);
    return () => clearInterval(timer);
  }, [text]);

  //Turn the page after a pause
  useEffect(() => {
    if (!done) {
      return;
    }
    const timer = setTimeout(() => setPage((p) => (p + 1) % pages.length), 3200);
    return () => clearTimeout(timer);
  }, [done, pages.length]);

  const next = () => done ? setPage((p) => (p + 1) % pages.length) : setShown(text.length);

  return (
    <div className={cn("dialogue cursor-pointer select-none px-5 pb-5 pt-4", !/\babsolute\b/.test(className ?? "") && "relative", className)} onClick={next}>
      <p className="sr-only">{speaker}: {pages.join(" ")}</p>
      <div aria-hidden="true">
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#6a50a8]">{speaker}</p>
        <p className="mt-1 min-h-[3.2em] text-[19px] leading-snug">{text.slice(0, shown)}</p>
        <span className={cn("absolute bottom-2.5 right-4 text-[13px] text-[#e05070]", done ? "blink" : "opacity-0")}>▼</span>
      </div>
    </div>
  );
}
