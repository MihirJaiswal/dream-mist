import { SignedInHome } from "@/components/site/home";
import { LatestCities } from "@/components/site/latest-cities";
import { BattleDesigner } from "@/components/site/landing/battle-designer";
import { BattleStage } from "@/components/site/landing/battle-stage";
import { Features } from "@/components/site/landing/features";
import { GameFeel } from "@/components/site/landing/game-feel";
import { Hero } from "@/components/site/landing/hero";
import { PressStart } from "@/components/site/landing/press-start";
import { StoryScrolls } from "@/components/site/landing/story-scrolls";
import { pageMetadata, siteDescription } from "@/lib/site";
import { sessionCookie } from "@/lib/supabase";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = pageMetadata({ description: siteDescription, path: "/" });

/** Home: the landing page for visitors, your games and cities once signed in (like Vercel's dashboard), told apart by the session cookie */
export default async function Home() {
  const signedIn = (await cookies()).getAll().some(({ name }) => sessionCookie.test(name));
  const landing = <Landing />;
  //An expired or revoked session shows the landing page after all
  return signedIn ? <SignedInHome fallback={landing} /> : landing;
}

/** What visitors see */
function Landing() {
  return (
    <div className="night overflow-hidden" data-landing>
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
