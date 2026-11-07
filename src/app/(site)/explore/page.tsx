import { ExploreGallery } from "@/components/site/explore-gallery";
import { pageMetadata } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Explore games",
  description: "Play, like and fork Pokémon games other people made with DreamMist, free in your browser.",
  path: "/explore",
});

/** Explore page */
export default function Explore() {
  return <ExploreGallery />;
}
