import { SignedInHome, signedInProbe } from "@/components/site/home";
import { LatestCities } from "@/components/site/latest-cities";
import { BattleDesigner } from "@/components/site/landing/battle-designer";
import { BattleStage } from "@/components/site/landing/battle-stage";
import { Features } from "@/components/site/landing/features";
import { GameFeel } from "@/components/site/landing/game-feel";
import { Hero } from "@/components/site/landing/hero";
import { PressStart } from "@/components/site/landing/press-start";
import { StoryScrolls } from "@/components/site/landing/story-scrolls";
import { pageMetadata, siteDescription } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({ description: siteDescription, path: "/" });

/** Home: the landing page for visitors, your games and cities once signed in (like Vercel's dashboard) */
export default function Home() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: signedInProbe }} />
      <SignedInHome />
      <div className="landing night overflow-hidden">
        <Hero />
        <BattleStage />
        <section className="px-4 py-16">
          <StoryScrolls />
        </section>
        <GameFeel />
        <BattleDesigner />
        <Features />
        <LatestCities />
        <PressStart />
      </div>
    </>
  );
}
