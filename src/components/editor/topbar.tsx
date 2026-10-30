"use client";

import { profile, signIn } from "@/components/editor/account-dialogs";
import { cities, newCity, settings, versionHistory } from "@/components/editor/city-dialogs";
import { useSession } from "@/components/editor/hooks";
import { publish, room, share } from "@/components/editor/share-dialogs";
import { openSearch } from "@/components/editor/shortcuts";
import { startTour } from "@/components/editor/tour";
import { card, party } from "@/components/editor/trainer-dialogs";
import { TextInput, Tip } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sound } from "@/game/audio";
import { cloud } from "@/game/cloud";
import { message } from "@/game/session";
import { cn } from "@/lib/utils";
import { Backpack, BookOpen, CaretDown, Check, ClockCounterClockwise, Cloud, DownloadSimple, Export, Folder, GearSix, GitFork, Globe, IdentificationCard, MagnifyingGlass, MapTrifold, PencilSimple, Play, Plus, Sparkle, SpeakerHigh, SpeakerSlash, Upload, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";

/** Where the city is saved, and what to do about it */
function SaveBadge() {
  const session = useSession();
  const pill = "flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs";
  if (session.room) {
    return <span title="Live room" className={cn(pill, "border-transparent text-success")}><Cloud size={13} /><span className="hidden lg:inline">Live</span></span>;
  }
  if (session.online) {
    return <Tip label={session.online.mine ? "Saved to your account" : "Saved to the owner's account"} description="Changes save on their own"><button onClick={() => cities()} className={cn(pill, "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground")}><Cloud size={13} /><span className="hidden lg:inline">Saved</span></button></Tip>;
  }
  if (!cloud.available) {
    return <span title="Saved on this device" className={cn(pill, "border-transparent text-muted-foreground")}><Folder size={13} /><span className="hidden lg:inline">Saved on this device</span></span>;
  }
  if (cloud.user) {
    return <Tip label="Not in your account yet" description="Click to save it to your account"><button onClick={() => session.upload().catch((error) => toast.error(message(error)))} className={cn(pill, "border-select/35 bg-select/10 text-select hover:bg-select/20")}><Upload size={13} /><span className="hidden lg:inline">Save to account</span></button></Tip>;
  }
  return <Tip label="Only saved in this browser" description="Log in so you don't lose it"><button onClick={() => signIn("save")} className={cn(pill, "border-select/35 bg-select/10 text-select hover:bg-select/20")}><Warning size={13} /><span className="hidden lg:inline">Only on this device</span></button></Tip>;
}

/** Top bar: city name and menu, Build/Play, sharing and the account */
export function Topbar() {
  const session = useSession();
  const { city, mode, visiting, room: live } = session;
  if (!city) {
    return null;
  }
  return (
    <header className="relative flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
      <a href="/" title="DreamMist home" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted"><img src="/game/images/dreammist.png" alt="DreamMist" width={24} height={24} className="[image-rendering:pixelated]" /></a>
      {visiting
        ? <div className="min-w-0"><b className="block truncate text-sm">{city.name}</b><small className="text-xs text-subtle-fg">{city.author ? `by ${city.author}` : ""}</small></div>
        : <TextInput aria-label="City name" title="Rename city" value={city.name} maxLength={40} onCommit={(name) => session.rename(name)} className="h-8 w-28 shrink-0 border-transparent bg-transparent px-2 font-semibold shadow-none md:w-44 hover:border-input focus-visible:border-input" />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label="City menu" title="City menu"><CaretDown size={13} /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {visiting ? null : <><DropdownMenuItem onSelect={() => settings()}><GearSix />City settings</DropdownMenuItem><DropdownMenuSeparator /></>}
          <DropdownMenuItem onSelect={() => cities()}><Folder />Your cities</DropdownMenuItem>
          {(session.online) && (!visiting) ? <DropdownMenuItem onSelect={() => versionHistory()}><ClockCounterClockwise />Version history</DropdownMenuItem> : null}
          <DropdownMenuItem onSelect={() => newCity()}><Plus />New city</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => session.exportImage()}><Export />Export image</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => session.exportJson()}><DownloadSimple />Export .json</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => (sound.toggle(), session.notify())}>{sound.muted ? <SpeakerHigh /> : <SpeakerSlash />}{sound.muted ? "Turn sound on" : "Turn sound off"}</DropdownMenuItem>
          <DropdownMenuItem asChild><a href="/explore"><MapTrifold />Explore cities</a></DropdownMenuItem>
          {visiting ? null : <DropdownMenuItem onSelect={() => startTour()}><Sparkle />Getting started tour</DropdownMenuItem>}
          <DropdownMenuItem asChild><a href="/docs"><BookOpen />Docs</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href="/"><Globe />DreamMist home</a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {visiting ? null : <SaveBadge />}
      {session.online?.forkOf && !visiting ? <a href={`/editor#visit=${session.online.forkOf.id}`} title={`Forked from ${session.online.forkOf.name} by ${session.online.forkOf.owner}`} className="hidden items-center gap-1 text-xs text-subtle-fg hover:text-foreground md:flex"><GitFork size={12} />{session.online.forkOf.name}</a> : null}

      <div className="flex shrink-0 rounded-lg bg-muted p-0.5 xl:absolute xl:left-1/2 xl:-translate-x-1/2">
        {visiting ? null : <button aria-label="Build" onClick={() => session.setMode("edit")} className={cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-sm", mode === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><PencilSimple size={14} /><span className="hidden sm:inline">Build</span></button>}
        <button aria-label="Play" onClick={() => session.setMode("play")} className={cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-sm", mode === "play" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Play size={14} /><span className="hidden sm:inline">Play</span></button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Tip label="Search commands" shortcut="⌘K" description="Find any action, tool, stamp, map or person"><Button variant="ghost" size="icon" aria-label="Search commands" onClick={openSearch}><MagnifyingGlass size={17} /></Button></Tip>
        {mode === "play" ? <Tip label="Party" description="Your Pokémon, PC box and bag"><Button variant="ghost" size="icon" aria-label="Party" onClick={() => party()}><Backpack size={17} /></Button></Tip> : null}
        {mode === "play" ? <Tip label="Trainer card" description="Badges, Pokédex and progress"><Button variant="ghost" size="icon" aria-label="Trainer card" onClick={() => card()}><IdentificationCard size={17} /></Button></Tip> : null}
        {live
          ? (
            <button title="Builders in this room" onClick={() => room()} className="flex items-center -space-x-1.5 rounded-full px-1 hover:bg-muted">
              {[live.you, ...live.peers.values()].slice(0, 4).map((peer) => <span key={peer.id} title={peer.name} className="grid size-7 place-items-center rounded-full border-2 border-card text-[11px] font-semibold text-white" style={{ background: peer.color }}>{peer.name[0]?.toUpperCase()}</span>)}
              <span className={cn("ml-2 size-2 rounded-full", session.roomStatus === "online" ? "bg-success" : session.roomStatus === "connecting" ? "bg-select" : "bg-destructive")} />
            </button>
          )
          : null}
        {visiting ? null : <Tip label={session.online?.published ? "Published on Explore" : "Publish"} description={session.online?.published ? "Update or unpublish your city on Explore" : "Share your finished city on Explore"}><Button variant="ghost" size="sm" onClick={() => publish()}>{session.online?.published ? <Check /> : <Export />}<span className="hidden sm:inline">{session.online?.published ? "Published" : "Publish"}</span></Button></Tip>}
        {visiting
          ? <Tip label="Fork" description="Make your own copy to build on top of"><Button size="sm" onClick={() => session.remix()}><GitFork />Fork</Button></Tip>
          : <Tip label="Share" description="Share or invite friends"><Button size="sm" onClick={() => share()}>Share</Button></Tip>}
        {cloud.available
          ? cloud.user
            ? <Tip label={`Signed in as ${cloud.user.username}`}><button onClick={() => profile(cities)} className="grid size-8 place-items-center rounded-full bg-foreground text-sm font-semibold text-background">{cloud.user.username[0].toUpperCase()}</button></Tip>
            : <Button variant="ghost" size="sm" onClick={() => signIn()}>Log in</Button>
          : null}
      </div>
    </header>
  );
}
