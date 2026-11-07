import { EditorLoader } from "@/components/editor/loader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor",
  description: "Make your Pokémon game: build its towns and routes, write its story and play it.",
  alternates: { canonical: "/editor" },
  //An app, not a page to find: shared games open here too (#visit=…), so links are followed but it isn't listed
  robots: { index: false, follow: true },
};

/** Editor and game (runs entirely in the browser) */
export default function EditorPage() {
  return <EditorLoader />;
}
