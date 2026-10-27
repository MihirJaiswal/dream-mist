"use client";

import { openDialog } from "@/components/editor/dialogs";
import { Field } from "@/components/editor/widgets";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cloud } from "@/game/cloud";
import { storage } from "@/game/data";
import { message, session } from "@/game/session";
import type { SignInReason } from "@/game/ui-bridge";
import { cn } from "@/lib/utils";
import { Cloud, Folder, IdentificationCard, Link, SignOut, Upload, UsersThree } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

/** Yes/no question */
export function confirm(title: string, { text = "", action = "Confirm", danger = false } = {}) {
  return openDialog<boolean>((close) => (
    <AlertDialog open onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {text ? <AlertDialogDescription>{text}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className={cn(danger && "bg-destructive text-white hover:bg-destructive/90")} onClick={() => close(true)}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )).then(Boolean);
}

/** Why someone is asked to sign in */
const reasons: Record<SignInReason, { title: string; text: string }> = {
  default: { title: "Welcome to DreamMist", text: "Log in to keep your towns and trainer safe, and take them to any device." },
  save: { title: "Keep your towns safe", text: "Right now your towns only live in this browser. Log in to save them to your account." },
  new: { title: "Keep your towns safe", text: "Log in before starting a new town, so both are saved to your account." },
  publish: { title: "Log in to publish", text: "Published towns belong to an account, so you can update them and see their likes." },
  share: { title: "Log in for short links", text: "Towns in your account get short links that always show your latest version." },
  room: { title: "Log in to build together", text: "Live rooms are saved in your account, so everyone's changes are kept." },
  upload: { title: "Log in to upload", text: "Uploads go to your account, so images can be bigger and share links stay short." },
};

/** Benefits of an account */
const perks = [
  { icon: Cloud, title: "Saved to your account", text: "Open your towns from any device" },
  { icon: IdentificationCard, title: "Your trainer comes along", text: "Party, badges and story progress" },
  { icon: Link, title: "Short share links", text: "Always show your latest version" },
  { icon: UsersThree, title: "Publish and build together", text: "Explore, likes, forks and live rooms" },
];

/** Sign in or create an account */
export function signIn(reason: SignInReason = "default") {
  if (!cloud.available) {
    toast.error("Online features aren't set up yet: see the README to connect Supabase.");
    return Promise.resolve();
  }
  return openDialog<void>((close) => <SignIn reason={reason} close={close} />).then(() => undefined);
}

function SignIn({ reason, close }: { reason: SignInReason; close: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (tab === "login") {
        await cloud.login(email, password);
      } else {
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
          throw new Error("Pick a username of 3 to 20 letters, numbers, _ or -");
        }
        if (!(await cloud.register(email, password, username.toLowerCase()))) {
          close();
          toast.success("Check your email to confirm your account, then log in.");
          return;
        }
      }
      close();
      await session.signedIn();
    } catch (e) {
      toast.error(tab === "login" ? "Couldn't log in" : "Couldn't create your account", { description: message(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{reasons[reason].title}</DialogTitle>
          <DialogDescription>{reasons[reason].text}</DialogDescription>
        </DialogHeader>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
          {perks.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-2"><Icon size={16} className="mt-0.5 shrink-0" /><div><b className="block text-xs">{title}</b><small className="text-[11px] text-subtle-fg">{text}</small></div></li>
          ))}
        </ul>
        <Button variant="outline" onClick={async () => {
          await session.persist();
          storage.set("signin-pending", true);
          await cloud.google().catch((e) => toast.error("Couldn't continue with Google", { description: message(e) }));
        }}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" /></svg>
          Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-subtle-fg"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>
        <form className="grid grid-cols-1 gap-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
            {(["login", "register"] as const).map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={cn("h-8 rounded text-sm", tab === value ? "bg-background shadow-sm" : "text-muted-foreground")}>{value === "login" ? "Log in" : "Create account"}</button>)}
          </div>
          {tab === "register" ? <Field label="Username" hint="Shown on your towns: 3 to 20 letters, numbers, _ or -"><Input value={username} autoComplete="username" placeholder="ash_ketchum" maxLength={20} onChange={(event) => setUsername(event.target.value)} /></Field> : null}
          <Field label="Email"><Input type="email" required value={email} autoComplete="email" placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="Password" hint={tab === "register" ? "At least 6 characters" : undefined}><Input type="password" required minLength={6} value={password} autoComplete={tab === "login" ? "current-password" : "new-password"} onChange={(event) => setPassword(event.target.value)} /></Field>
          <Button type="submit" disabled={busy}>{tab === "login" ? "Log in" : "Create account"}</Button>
        </form>
        <p className="text-center text-[11px] text-subtle-fg">Your towns in this browser stay here either way. After logging in you can bring them into your account.</p>
      </DialogContent>
    </Dialog>
  );
}

/** Offer to save this browser's towns to the account */
export function bring(cities: { id: string; name: string; width: number; height: number; people: number; updated: number }[]) {
  return openDialog<void>((close) => <Bring cities={cities} close={close} />).then(() => undefined);
}

function Bring({ cities, close }: { cities: { id: string; name: string; width: number; height: number; people: number; updated: number }[]; close: () => void }) {
  const [picked, setPicked] = useState(() => new Set(cities.map(({ id }) => id)));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const saved = await session.bring([...picked]);
      close();
      toast.success(`${saved} town${saved > 1 ? "s" : ""} saved to your account`);
    } catch (error) {
      toast.error(message(error));
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bring your towns along</DialogTitle>
          <DialogDescription>These towns are only saved in this browser. Save them to your account to keep them safe and open them anywhere.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-80 gap-1 overflow-y-auto">
          {cities.map((city) => (
            <label key={city.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 hover:bg-muted/50">
              <Checkbox checked={picked.has(city.id)} onCheckedChange={(value) => setPicked((set) => { const next = new Set(set); if (value) next.add(city.id); else next.delete(city.id); return next; })} />
              <div className="min-w-0 flex-1"><b className="block truncate text-sm">{city.name}</b><small className="text-xs text-subtle-fg">{city.width}×{city.height} · {city.people} on the map · edited {new Date(city.updated).toLocaleDateString()}</small></div>
              {city.id === session.city?.id ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Open now</span> : null}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>Not now</Button>
          <Button disabled={busy || !picked.size} onClick={save}>{picked.size ? `Save ${picked.size} town${picked.size > 1 ? "s" : ""} to my account` : "Choose towns to save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Account panel (signed in) */
export function profile(onCities: () => void) {
  return openDialog<void>((close) => <Profile close={close} onCities={onCities} />);
}

function Profile({ close, onCities }: { close: () => void; onCities: () => void }) {
  const user = cloud.user!;
  const local = session.localCities();
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Your account</DialogTitle><DialogDescription className="sr-only">Account details</DialogDescription></DialogHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">{user.username[0].toUpperCase()}</span>
          <div><b className="block">{user.username}</b><small className="text-xs text-muted-foreground">{user.email || "Your towns and trainer progress are saved to your account."}</small></div>
        </div>
        {local.length
          ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <Upload size={16} className="shrink-0" />
              <span className="flex-1 text-muted-foreground">{local.length} town{local.length > 1 ? "s are" : " is"} still only in this browser.</span>
              <Button size="sm" variant="secondary" onClick={() => (close(), bring(local.map((city) => ({ id: city.id, name: city.name, width: city.width, height: city.height, people: city.npcs.length, updated: city.updated }))))}>Save them</Button>
            </div>
          )
          : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => (close(), onCities())}><Folder />Your cities</Button>
          <Button variant="outline" onClick={async () => {
            if (await confirm("Log out?", { text: "Your towns stay in your account. Towns in this browser stay here too, and you can log back in anytime.", action: "Log out" })) {
              await session.logout();
              close();
              toast.success("Logged out");
            }
          }}><SignOut />Log out</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Name for joining a live room as a guest (or log in) */
export function guestName() {
  return openDialog<string>((close) => <GuestName close={close} />).then((name) => name ?? "");
}

function GuestName({ close }: { close: (name?: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && close(name.trim() || "Guest")}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Join the build</DialogTitle>
          <DialogDescription>A friend invited you to build their city together. Log in to keep it in your library, or join as a guest.</DialogDescription>
        </DialogHeader>
        <Field label="Name"><Input autoFocus value={name} placeholder="Your name" maxLength={20} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && close(name.trim() || "Guest")} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={async () => (await signIn("room"), close(cloud.user?.username ?? (name.trim() || "Guest")))}>Log in</Button>
          <Button onClick={() => close(name.trim() || "Guest")}>Join as guest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
