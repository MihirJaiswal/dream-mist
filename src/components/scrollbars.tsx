"use client";

import { useEffect } from "react";

/** How long a scrollbar stays visible after the last scroll */
const linger = 900;

/**
 * Shows scrollbars only while scrolling: marks the element being scrolled with `data-scrolling`
 * for a moment, and globals.css only paints the scrollbar thumb on marked elements.
 */
export function ScrollbarActivity() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const scrolled = (event: Event) => {
      const element = event.target instanceof Element ? event.target : document.documentElement;
      clearTimeout(timers.get(element));
      element.setAttribute("data-scrolling", "");
      timers.set(element, window.setTimeout(() => element.removeAttribute("data-scrolling"), linger));
    };
    document.addEventListener("scroll", scrolled, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", scrolled, { capture: true });
  }, []);
  return null;
}
