import { LatestCities } from "@/components/site/latest-cities";
import { BattleStage } from "@/components/site/landing/battle-stage";
import { Features } from "@/components/site/landing/features";
import { Hero } from "@/components/site/landing/hero";
import { PartyWall } from "@/components/site/landing/party-wall";
import { PressStart } from "@/components/site/landing/press-start";
import { StoryScrolls } from "@/components/site/landing/story-scrolls";
import { Welcome } from "@/components/site/landing/welcome";

/** Landing page */
export default function Home() {
  return (
    <div className="night overflow-hidden">
      <Hero />
      <Welcome />
      <BattleStage />
      <section className="px-4 py-16">
        <StoryScrolls />
      </section>
      <PartyWall />
      <Features />
      <LatestCities />
      <PressStart />
    </div>
  );
}
