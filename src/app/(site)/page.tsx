import { LatestCities } from "@/components/site/latest-cities";
import { BattleDesigner } from "@/components/site/landing/battle-designer";
import { BattleStage } from "@/components/site/landing/battle-stage";
import { Features } from "@/components/site/landing/features";
import { GameFeel } from "@/components/site/landing/game-feel";
import { Hero } from "@/components/site/landing/hero";
import { PressStart } from "@/components/site/landing/press-start";
import { StoryScrolls } from "@/components/site/landing/story-scrolls";

/** Landing page */
export default function Home() {
  return (
    <div className="night overflow-hidden">
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
  );
}
