import { EditorLoader } from "@/components/editor/loader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor",
  description: "Build your Pokémon town, write its story and play it.",
};

/** Editor and game (runs entirely in the browser) */
export default function EditorPage() {
  return <EditorLoader />;
}
