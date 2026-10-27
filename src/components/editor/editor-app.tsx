"use client";

import "@/components/editor/game.css";
import { bring, confirm, guestName, signIn } from "@/components/editor/account-dialogs";
import { importSprite, importTileset } from "@/components/editor/city-dialogs";
import { DialogHost } from "@/components/editor/dialogs";
import { useSession } from "@/components/editor/hooks";
import { BattleScreen, DialogueBox, Fade, Gamepad, hush, MapBanner, SaveNudge, say } from "@/components/editor/overlays";
import { ToolRail } from "@/components/editor/rail";
import { Sidebar } from "@/components/editor/sidebar";
import { Topbar } from "@/components/editor/topbar";
import { onboarding } from "@/components/editor/trainer-dialogs";
import { MapControls, Minimap, StatusBar, usePreference } from "@/components/editor/viewport";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { message, session } from "@/game/session";
import { installUi } from "@/game/ui-bridge";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Loading screen with the DreamMist loader */
function Loading({ progress }: { progress: string }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[url(/game/images/loaderbg.png)] bg-cover bg-center [image-rendering:pixelated]">
      <div className="grid justify-items-center gap-4 rounded-2xl bg-black/40 px-8 py-6 backdrop-blur">
        <img src="/game/images/loader.gif" alt="" className="w-48 rounded-lg" />
        <p className="font-pixel text-xs text-white/90">{progress}</p>
      </div>
    </div>
  );
}

/** DreamMist editor and game */
export function EditorApp() {
  useSession();
  const viewport = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState("Loading DreamMist…");
  const [collapsed, setCollapsed] = usePreference("sidebar-collapsed", false);
  const [minimap, setMinimap] = usePreference("minimap", true);

  useEffect(() => {
    installUi({
      toast: (text, type = "info") => toast[type](text),
      say,
      hush,
      confirm,
      signIn,
      onboarding,
      guestName,
      bring,
    });
    session.boot(viewport.current!, setProgress).catch((error) => setProgress(`Failed to load: ${message(error)}`));
  }, []);

  const edit = (session.ready) && (session.mode === "edit");
  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Topbar />
        <main className="flex min-h-0 flex-1">
          {edit ? <ToolRail /> : null}
          {(edit) && (!collapsed) ? <Sidebar onImportTileset={() => importTileset()} onSprite={importSprite} /> : null}
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div ref={viewport} className="absolute inset-0 [&_canvas]:block" />
            {session.ready && minimap ? <Minimap /> : null}
            {session.ready ? <MapControls minimap={minimap} onMinimap={() => setMinimap(!minimap)} onPanel={() => setCollapsed(!collapsed)} /> : null}
            <MapBanner />
            <SaveNudge onLogin={() => signIn("save")} />
            {session.ready ? null : <Loading progress={progress} />}
          </div>
        </main>
        <StatusBar />
      </div>
      <DialogueBox />
      <BattleScreen />
      <Gamepad />
      <Fade />
      <DialogHost />
      <Toaster position="bottom-right" closeButton />
    </TooltipProvider>
  );
}
