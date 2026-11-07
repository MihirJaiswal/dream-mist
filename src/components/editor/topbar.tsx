"use client";

import { profile, signIn } from "@/components/editor/account-dialogs";
import { cities, newCity, settings, versionHistory } from "@/components/editor/city-dialogs";
import { useSession } from "@/components/editor/hooks";
import { publish, room, share } from "@/components/editor/share-dialogs";
import { openSearch } from "@/components/editor/shortcuts";
import { startTour } from "@/components/editor/tour";
import { party } from "@/components/editor/gba-screens";
import { card, journalDialog, townMap, wildDialog } from "@/components/editor/trainer-dialogs";
import { TextInput, Tip } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sound } from "@/game/audio";
import { cloud } from "@/game/cloud";
import { message } from "@/game/session";
import { cn } from "@/lib/utils";
import {
  Backpack,
  BookOpen,
  CaretDown,
  Check,
  ClockCounterClockwise,
  Cloud,
  DotsThree,
  DownloadSimple,
  Export,
  Folder,
  GearSix,
  GitFork,
  Globe,
  IdentificationCard,
  MagnifyingGlass,
  MapTrifold,
  Notebook,
  PawPrint,
  PencilSimple,
  Play,
  Plus,
  ShareNetwork,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  Upload,
  Warning,
} from "@phosphor-icons/react";
import { Fragment, type ReactNode } from "react";
import { toast } from "sonner";

/** Where the city is saved, and what to do about it */
function SaveBadge() {
  const session = useSession();
  const pill = "grid size-7 shrink-0 place-items-center rounded-full border";
  if (session.room) {
    return (
      <span title="Live room: everyone here builds together" className={cn(pill, "border-transparent text-success")}>
        <Cloud size={13} />
        <span className="sr-only">Live</span>
      </span>
    );
  }
  if (session.online) {
    return (
      <Tip label={session.online.mine ? "Saved to your account" : "Saved to the owner's account"} description="Changes save on their own">
        <button onClick={() => cities()} className={cn(pill, "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <Cloud size={13} />
          <span className="sr-only">Saved</span>
        </button>
      </Tip>
    );
  }
  if (!cloud.available) {
    return (
      <span title="Saved on this device" className={cn(pill, "border-transparent text-muted-foreground")}>
        <Folder size={13} />
        <span className="sr-only">Saved on this device</span>
      </span>
    );
  }
  if (cloud.user) {
    return (
      <Tip label="Not in your account yet" description="Click to save it to your account">
        <button
          onClick={() => session.upload().catch((error) => toast.error(message(error)))}
          className={cn(pill, "border-select/35 bg-select/10 text-select hover:bg-select/20")}
        >
          <Upload size={13} />
          <span className="sr-only">Save to account</span>
        </button>
      </Tip>
    );
  }
  return (
    <Tip label="Only saved in this browser" description="Log in so you don't lose it">
      <button onClick={() => signIn("save")} className={cn(pill, "border-select/35 bg-select/10 text-select hover:bg-select/20")}>
        <Warning size={13} />
        <span className="sr-only">Only on this device</span>
      </button>
    </Tip>
  );
}

/** Top bar: city name and menu, Build/Play, sharing and the account */
export function Topbar() {
  const session = useSession();
  const { city, mode, visiting, room: live } = session;
  if (!city) {
    return null;
  }
  const published = Boolean(session.online?.published);
  //Top bar actions: icons on wide screens, a menu on phones (the play tools only show while playing)
  const actions: { label: string; description: string; shortcut?: string; icon: ReactNode; onClick: () => void; separate?: boolean }[] = [
    {
      label: "Search commands",
      description: "Find any action, tool, stamp, map or person",
      shortcut: "⌘K",
      icon: <MagnifyingGlass size={17} />,
      onClick: openSearch,
    },
    ...(mode === "play"
      ? [
          { label: "Party", description: "Your Pokémon, PC box and bag", icon: <Backpack size={17} />, onClick: () => party(), separate: true },
          { label: "Journal", description: "What to do next, and your side quests (J)", icon: <Notebook size={17} />, onClick: () => journalDialog() },
          { label: "Pokémon here", description: "Wild Pokémon living on this map (N)", icon: <PawPrint size={17} />, onClick: () => wildDialog() },
          { label: "Town Map", description: "Where you are in the town (M)", icon: <MapTrifold size={17} />, onClick: () => townMap() },
          { label: "Trainer card", description: "Badges, Pokédex and progress", icon: <IdentificationCard size={17} />, onClick: () => card() },
        ]
      : []),
    ...(visiting
      ? []
      : [
          { label: "Share", description: "Share or invite friends", icon: <ShareNetwork size={17} />, onClick: () => share(), separate: true },
          {
            label: published ? "Published on Explore" : "Publish",
            description: published ? "Update or unpublish your city on Explore" : "Share your finished city on Explore",
            icon: published ? <Check size={17} /> : <Export size={17} />,
            onClick: () => publish(),
          },
        ]),
  ];
  return (
    <header className="relative flex h-12 shrink-0 items-center gap-1 border-b border-border bg-card px-2">
      <a href="/" title="DreamMist home" className="hidden size-9 shrink-0 place-items-center rounded-md hover:bg-muted sm:grid">
        <img src="/game/images/dreammist.png" alt="DreamMist" width={24} height={24} className="[image-rendering:pixelated]" />
      </a>
      {visiting ? (
        <div className="min-w-0">
          <b className="block truncate text-sm">{city.name}</b>
          <small className="text-xs text-subtle-fg">{city.author ? `by ${city.author}` : ""}</small>
        </div>
      ) : (
        <TextInput
          aria-label="City name"
          title="Rename city"
          value={city.name}
          maxLength={40}
          onCommit={(name) => session.rename(name)}
          className="h-8 w-24 shrink-0 border-transparent sm:w-28 bg-transparent px-2 font-semibold shadow-none md:w-44 hover:border-input focus-visible:border-input"
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="City menu" title="City menu">
            <CaretDown size={13} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {visiting ? null : (
            <>
              <DropdownMenuItem onSelect={() => settings()}>
                <GearSix />
                City settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => cities()}>
            <Folder />
            Your cities
          </DropdownMenuItem>
          {session.online && !visiting ? (
            <DropdownMenuItem onSelect={() => versionHistory()}>
              <ClockCounterClockwise />
              Version history
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => newCity()}>
            <Plus />
            New city
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => session.exportImage()}>
            <Export />
            Export image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => session.exportJson()}>
            <DownloadSimple />
            Export .json
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => (sound.toggle(), session.notify())}>
            {sound.muted ? <SpeakerHigh /> : <SpeakerSlash />}
            {sound.muted ? "Turn sound on" : "Turn sound off"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/explore">
              <MapTrifold />
              Explore cities
            </a>
          </DropdownMenuItem>
          {visiting ? null : (
            <DropdownMenuItem onSelect={() => startTour()}>
              <Sparkle />
              Getting started tour
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href="/docs">
              <BookOpen />
              Docs
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/">
              <Globe />
              DreamMist home
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {visiting ? null : <SaveBadge />}
      {session.online?.forkOf && !visiting ? (
        <a
          href={`/editor#visit=${session.online.forkOf.id}`}
          title={`Forked from ${session.online.forkOf.name} by ${session.online.forkOf.owner}`}
          className="hidden items-center gap-1 text-xs text-subtle-fg hover:text-foreground md:flex"
        >
          <GitFork size={12} />
          {session.online.forkOf.name}
        </a>
      ) : null}

      <div className="flex shrink-0 rounded-lg bg-muted p-0.5 xl:absolute xl:left-1/2 xl:-translate-x-1/2">
        {visiting ? null : (
          <button
            aria-label="Build"
            onClick={() => session.setMode("edit")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-3 text-sm",
              mode === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <PencilSimple size={14} />
            <span className="hidden sm:inline">Build</span>
          </button>
        )}
        <button
          aria-label="Play"
          onClick={() => session.setMode("play")}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-3 text-sm",
            mode === "play" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Play size={14} />
          <span className="hidden sm:inline">Play</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Wide screens: every action as an icon, named in its tooltip */}
        <div className="hidden items-center gap-1 md:flex">
          {actions.map(({ label, description, shortcut, icon, onClick }) => (
            <Tip key={label} label={label} description={description} shortcut={shortcut}>
              <Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>
                {icon}
              </Button>
            </Tip>
          ))}
        </div>
        {/* Phones: the same actions in one menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="More">
              <DotsThree size={20} weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {actions.map(({ label, icon, onClick, separate }) => (
              <Fragment key={label}>
                {separate ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onSelect={onClick}>
                  {icon}
                  {label}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {live ? (
          <button title="Builders in this room" onClick={() => room()} className="flex items-center -space-x-1.5 rounded-full px-1 hover:bg-muted">
            {[live.you, ...live.peers.values()].slice(0, 4).map((peer) => (
              <span
                key={peer.id}
                title={peer.name}
                className="grid size-7 place-items-center rounded-full border-2 border-card text-[11px] font-semibold text-white"
                style={{ background: peer.color }}
              >
                {peer.name[0]?.toUpperCase()}
              </span>
            ))}
            <span
              className={cn(
                "ml-2 size-2 rounded-full",
                session.roomStatus === "online" ? "bg-success" : session.roomStatus === "connecting" ? "bg-select" : "bg-destructive",
              )}
            />
          </button>
        ) : null}
        {visiting ? (
          <Tip label="Fork" description="Make your own copy to build on top of">
            <Button size="sm" onClick={() => session.remix()}>
              <GitFork />
              <span className="hidden sm:inline">Fork</span>
            </Button>
          </Tip>
        ) : null}
        {cloud.available ? (
          cloud.user ? (
            <Tip label={`Signed in as ${cloud.user.username}`}>
              <button
                onClick={() => profile(cities)}
                className="ml-1 grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background"
              >
                {cloud.user.username[0].toUpperCase()}
              </button>
            </Tip>
          ) : (
            <Tip label="Log in" description="Keep your towns safe and open them on any device">
              <Button size="sm" className="ml-1" onClick={() => signIn()}>
                Log in
              </Button>
            </Tip>
          )
        ) : null}
      </div>
    </header>
  );
}
