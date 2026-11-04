import { EditorLoader } from "@/components/editor/loader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor",
  description: "Make your Pokémon game: build its towns and routes, write its story and play it.",
};

/** Editor and game (runs entirely in the browser) */
export default function EditorPage() {
  return <EditorLoader />;
}
