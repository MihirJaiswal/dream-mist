import { ExploreGallery } from "@/components/site/explore-gallery";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore games",
  description: "Play, like and fork Pokémon games made with DreamMist.",
};

/** Explore page */
export default function Explore() {
  return <ExploreGallery />;
}
