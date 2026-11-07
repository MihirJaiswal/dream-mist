import { EditorLoader } from "@/components/editor/loader";
import { gameCard } from "@/lib/games";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

/** The tab shows the game's name; search engines list its game page (/g/{id}) instead */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = await gameCard(id);
  return {
    title: card ? `Play ${card.name}` : "Play",
    alternates: { canonical: `/g/${id}` },
    robots: { index: false, follow: true },
  };
}

/** A game on its own, without the editor's tools (the game reads its id from the address) */
export default function PlayPage() {
  return <EditorLoader />;
}
