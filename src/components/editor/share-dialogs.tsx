"use client";

import { confirm } from "@/components/editor/account-dialogs";
import { Description } from "@/components/editor/city-dialogs";
import { openDialog } from "@/components/editor/dialogs";
import { useSession } from "@/components/editor/hooks";
import { Field, Hint } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { size } from "@/game/assets";
import { type Card, cloud } from "@/game/cloud";
import { checklist, message, session } from "@/game/session";
import { CheckCircle, Copy, DownloadSimple, Export, Link, MinusCircle, SignOut, UsersThree } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Read-only link with a copy button */
function Copyable({ value }: { value: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} onFocus={(event) => event.target.select()} className="font-mono text-xs" />
      <Button variant="outline" size="sm" className="h-9" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Link copied"), () => toast.warning("Couldn't copy: select the link and press Ctrl+C"))}><Copy />Copy</Button>
    </div>
  );
}

//=================================================================================================
// Share

export function share() {
  return openDialog<void>((close) => <Share close={close} />);
}

function Share({ close }: { close: () => void }) {
  const live = useSession();
  const [links, setLinks] = useState<null | { visit: string; remix: string; packed: boolean }>(null);
  const [author, setAuthor] = useState(session.city.author);
  //Short links once the city is saved online
  useEffect(() => void session.links().then(setLinks), [live.online?.id]);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Share your city</DialogTitle><DialogDescription>Friends who open the link can walk around, battle your trainers and catch Pokémon.</DialogDescription></DialogHeader>
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <UsersThree size={18} className="shrink-0" />
          <span className="flex-1 text-muted-foreground">{session.room ? `Live room open with ${session.room.peers.size} other builder${session.room.peers.size === 1 ? "" : "s"}.` : "Want friends to build this city with you in real time?"}</span>
          <Button size="sm" variant="secondary" onClick={() => (close(), room())}>{session.room ? "Open room" : "Invite builders"}</Button>
        </div>
        <Field label="Made by"><Input value={author} maxLength={40} placeholder="Your name" onChange={(event) => setAuthor(event.target.value)} onBlur={() => session.setAuthor(author)} /></Field>
        {links
          ? (
            <>
              <Field label="Visit link" hint={links.packed ? `The whole city is packed inside the link (${(links.visit.length / 1024).toFixed(1)} KB).${links.visit.length > 30000 ? " Some chat apps cut long links." : ""}` : "Friends always see your latest version."}><Copyable value={links.visit} /></Field>
              <Field label="Remix link" hint="Opens a copy in the editor."><Copyable value={links.remix} /></Field>
            </>
          )
          : <Hint>Making links…</Hint>}
        {links?.packed && cloud.available
          ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <Link size={18} className="shrink-0" />
              <span className="flex-1 text-muted-foreground">Save this city to your account to get short links that always show your latest version.</span>
              <Button size="sm" variant="secondary" onClick={() => session.upload("share").then(async (done) => void (done && setLinks(await session.links())), (error) => toast.error(message(error)))}>Save online</Button>
            </div>
          )
          : null}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => session.exportImage()}><Export />Export image</Button>
          <Button variant="outline" size="sm" onClick={() => session.exportJson()}><DownloadSimple />Export .json</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Publish

export async function publish() {
  if (!cloud.available) {
    return toast.error("Publishing needs online features to be set up (see the README).");
  }
  let card: Card | null;
  try {
    card = await session.publishing();
  } catch (error) {
    return toast.error(message(error));
  }
  if (card) {
    await openDialog<void>((close) => <Publish card={card!} close={close} />);
  }
}

function Publish({ card, close }: { card: Card; close: () => void }) {
  const city = session.city;
  const [description, setDescription] = useState(card.description ?? "");
  const [busy, setBusy] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const scale = Math.min(1, 520 / (city.width * size), 320 / (city.height * size));
    const canvas = session.map.snapshot(scale) as HTMLCanvasElement;
    canvas.className = "mx-auto block max-w-full rounded-md border border-border [image-rendering:pixelated]";
    preview.current = canvas;
    holder.current?.replaceChildren(canvas);
  }, [city]);
  const items = checklist(city);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{card.published ? "Published on Explore" : "Publish your city"}</DialogTitle>
          <DialogDescription>{card.published ? "Your city is live on Explore. Update it after making changes so the preview and details stay fresh." : "Mark your city as finished and share it on Explore, where anyone can play it, like it, or fork it to build their own version on top."}</DialogDescription>
        </DialogHeader>
        <div ref={holder} />
        <div><b className="block">{city.name}</b><small className="text-xs text-subtle-fg">by {cloud.user?.username ?? city.author} · {city.width}×{city.height}{city.interiors.length ? ` · ${city.interiors.length} interior${city.interiors.length > 1 ? "s" : ""}` : ""}</small></div>
        <Field label="Description"><Description value={description} onChange={setDescription} /></Field>
        <div className="grid gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Checklist</p>
          <ul className="grid gap-1">{items.map(({ ok, text }) => <li key={text} className={ok ? "flex items-center gap-2 text-sm" : "flex items-center gap-2 text-sm text-subtle-fg"}>{ok ? <CheckCircle size={15} className="text-success" /> : <MinusCircle size={15} />}{text}</li>)}</ul>
          <Hint>The checklist is a guide: you can publish at any time.</Hint>
        </div>
        <DialogFooter>
          {card.published ? <Button variant="outline" onClick={async () => {
            if (await confirm("Unpublish this city?", { text: "It disappears from Explore. Share links keep working.", action: "Unpublish", danger: true })) {
              await session.unpublish().then(() => (close(), toast.success("Removed from Explore")), (error) => toast.error(message(error)));
            }
          }}>Unpublish</Button> : null}
          <Button variant="ghost" asChild><a href="/explore" target="_blank">Open Explore</a></Button>
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              await session.publish(description, preview.current!);
              close();
              toast.success(card.published ? "Explore page updated" : "Published! Your city is on Explore");
            } catch (error) {
              toast.error(message(error));
              setBusy(false);
            }
          }}>{card.published ? "Update" : "Publish to Explore"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// Build together

export async function room() {
  if (!cloud.available) {
    return toast.error("Live rooms need online features to be set up (see the README).");
  }
  try {
    if (!(await session.startRoom())) {
      return;
    }
  } catch (error) {
    return toast.error(message(error));
  }
  await openDialog<void>((close) => <Room close={close} />);
}

function Room({ close }: { close: () => void }) {
  const session = useSession();
  const [text, setText] = useState("");
  const room = session.room;
  if (!room) {
    return null;
  }
  const builders = [room.you, ...room.peers.values()];
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Build together</DialogTitle><DialogDescription>Send this link to your friends. Everyone who opens it builds in this city with you in real time, and changes are saved automatically.</DialogDescription></DialogHeader>
        <Field label="Invite link"><Copyable value={room.link} /></Field>
        <div className="grid gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Builders online</p>
          {builders.map((peer) => (
            <div key={peer.id} className="flex items-center gap-2 text-sm">
              <span className="grid size-6 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: peer.color }}>{peer.name[0]?.toUpperCase()}</span>
              {peer.name}{peer.id === room.you.id ? " (you)" : ""}{(peer.id === room.you.id) && (room.host) ? <span className="text-[11px] text-subtle-fg">saves the room</span> : null}
            </div>
          ))}
        </div>
        <div className="grid gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Chat</p>
          <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
            {session.chat.length ? session.chat.map((line, i) => <p key={i}><b style={{ color: line.color }}>{line.name}</b> {line.text}</p>) : <span className="text-xs text-subtle-fg">No messages yet.</span>}
          </div>
          <Input value={text} placeholder="Say something to your builders…" maxLength={200} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
            if ((event.key === "Enter") && (text.trim())) {
              room.chat(text.trim());
              setText("");
            }
          }} />
        </div>
        <DialogFooter>
          {session.online?.mine ? <Button variant="outline" size="sm" onClick={async () => (await confirm("Create a new invite link?", { text: "The old link stops working for new builders.", action: "Create link" })) && session.resetInvite().catch((error) => toast.error(message(error)))}><Link />Reset link</Button> : null}
          <Button variant="outline" size="sm" onClick={() => (session.leaveRoom(), history.replaceState(null, "", location.pathname), close())}><SignOut />Leave room</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
