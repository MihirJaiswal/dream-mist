"use client";

import "@/components/editor/game.css";
import { bring, confirm, guestName, signIn } from "@/components/editor/account-dialogs";
import { importSprite, importTileset } from "@/components/editor/city-dialogs";
import { DialogHost } from "@/components/editor/dialogs";
import { useSession } from "@/components/editor/hooks";
import { ask, banner, BattleScreen, choose, DialogueBox, Fade, Gamepad, hush, MapBanner, QuestBanner, SaveNudge, say } from "@/components/editor/overlays";
import { ToolRail } from "@/components/editor/rail";
import { Sidebar } from "@/components/editor/sidebar";
import { Topbar } from "@/components/editor/topbar";
import { onboarding, shop } from "@/components/editor/trainer-dialogs";
import { CommandPalette } from "@/components/editor/command-palette";
import { useAppShortcuts } from "@/components/editor/shortcuts";
import { Tour } from "@/components/editor/tour";
import { MapControls, MapMenu, Minimap, StatusBar, usePreference } from "@/components/editor/viewport";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { message, session } from "@/game/session";
import { installUi } from "@/game/ui-bridge";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Loading screen with the DreamMist loader */
function Loading({ progress }: { progress: string }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[url(/game/images/loaderbg.avif)] bg-cover bg-center [image-rendering:pixelated]">
      <div className="grid justify-items-center gap-5">
        <img src="/game/images/loader.gif" alt="" className="w-[min(26rem,80vw)] rounded-lg" />
        <p className="font-pixel text-sm text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{progress}</p>
      </div>
    </div>
  );
}

/** DreamMist editor and game */
export function EditorApp() {
  useSession();
  const viewport = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState("Loading DreamMist…");
  //Small screens (phones, tablets held upright) start with the side panel closed, so the map has room
  const [collapsed, setCollapsed] = usePreference("sidebar-collapsed", window.innerWidth < 900);
  const [minimap, setMinimap] = usePreference("minimap", true);

  useEffect(() => {
    installUi({
      toast: (text, type = "info") => toast[type](text),
      say,
      ask,
      choose,
      hush,
      shop,
      banner,
      confirm,
      signIn,
      onboarding,
      guestName,
      bring,
    });
    session.boot(viewport.current!, setProgress).catch((error) => setProgress(`Failed to load: ${message(error)}`));
  }, []);

  //⌘\ hides the panels to show just the map
  const [panels, setPanels] = useState(true);
  const togglePanels = useCallback(
    () =>
      setPanels((shown) => {
        if (shown) {
          toast("Panels hidden", { id: "panels", description: "Press ⌘\\ to bring them back" });
        } else {
          toast.dismiss("panels");
        }
        return !shown;
      }),
    [],
  );
  useAppShortcuts({ onPanels: togglePanels });

  const edit = session.ready && session.mode === "edit";
  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        {session.ready ? <Topbar /> : null}
        <main className="flex min-h-0 flex-1">
          {edit && panels ? <ToolRail /> : null}
          {edit && panels && !collapsed ? <Sidebar onImportTileset={() => importTileset()} onSprite={importSprite} /> : null}
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div ref={viewport} className="absolute inset-0 [&_canvas]:block" />
            {session.ready && minimap && panels ? <Minimap /> : null}
            {session.ready ? <MapControls minimap={minimap} onMinimap={() => setMinimap(!minimap)} onPanel={() => setCollapsed(!collapsed)} /> : null}
            {session.ready ? <MapMenu /> : null}
            {session.ready ? <Tour /> : null}
            <MapBanner />
            <SaveNudge onLogin={() => signIn("save")} />
            {session.ready ? null : <Loading progress={progress} />}
          </div>
        </main>
        {session.ready ? <StatusBar /> : null}
      </div>
      <DialogueBox />
      <QuestBanner />
      <BattleScreen />
      <Gamepad />
      <Fade />
      <CommandPalette />
      <DialogHost />
      <Toaster position="bottom-right" closeButton />
    </TooltipProvider>
  );
}
