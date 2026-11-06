"use client";

import { openDialog } from "@/components/editor/dialogs";
import { Field } from "@/components/editor/widgets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cloud } from "@/game/cloud";
import { storage } from "@/game/data";
import { message, session } from "@/game/session";
import type { SignInReason } from "@/game/ui-bridge";
import { LoginWindow } from "@/components/login";
import { Folder, SignOut, Upload } from "@phosphor-icons/react";
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
          <AlertDialogAction variant={danger ? "destructive" : "default"} onClick={() => close(true)}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )).then(Boolean);
}

/** Sign in with the DreamMist login window (Google, or an emailed link): the town is saved first, and the editor finishes signing in on return */
export function signIn(reason: SignInReason = "default") {
  if (!cloud.available) {
    toast.error("Online features aren't set up yet: see the README to connect Supabase.");
    return Promise.resolve();
  }
  return openDialog<void>((close) => (
    <LoginWindow
      reason={reason}
      onClose={() => close()}
      prepare={async () => {
        await session.persist();
        storage.set("signin-pending", true);
      }}
    />
  )).then(() => undefined);
}

/** Offer to save this browser's towns to the account */
export function bring(cities: { id: string; name: string; width: number; height: number; people: number; updated: number }[]) {
  return openDialog<void>((close) => <Bring cities={cities} close={close} />).then(() => undefined);
}

function Bring({
  cities,
  close,
}: {
  cities: { id: string; name: string; width: number; height: number; people: number; updated: number }[];
  close: () => void;
}) {
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
              <Checkbox
                checked={picked.has(city.id)}
                onCheckedChange={(value) =>
                  setPicked((set) => {
                    const next = new Set(set);
                    if (value) next.add(city.id);
                    else next.delete(city.id);
                    return next;
                  })
                }
              />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{city.name}</b>
                <small className="text-xs text-subtle-fg">
                  {city.width}×{city.height} · {city.people} on the map · edited {new Date(city.updated).toLocaleDateString()}
                </small>
              </div>
              {city.id === session.city?.id ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Open now</span> : null}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Not now
          </Button>
          <Button disabled={busy || !picked.size} onClick={save}>
            {picked.size ? `Save ${picked.size} town${picked.size > 1 ? "s" : ""} to my account` : "Choose towns to save"}
          </Button>
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
        <DialogHeader>
          <DialogTitle>Your account</DialogTitle>
          <DialogDescription className="sr-only">Account details</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">
            {user.username[0].toUpperCase()}
          </span>
          <div>
            <b className="block">{user.username}</b>
            <small className="text-xs text-muted-foreground">{user.email || "Your towns and trainer progress are saved to your account."}</small>
          </div>
        </div>
        {local.length ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <Upload size={16} className="shrink-0" />
            <span className="flex-1 text-muted-foreground">
              {local.length} town{local.length > 1 ? "s are" : " is"} still only in this browser.
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => (
                close(),
                bring(
                  local.map((city) => ({
                    id: city.id,
                    name: city.name,
                    width: city.width,
                    height: city.height,
                    people: city.npcs.length,
                    updated: city.updated,
                  })),
                )
              )}
            >
              Save them
            </Button>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => (close(), onCities())}>
            <Folder />
            Your cities
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (
                await confirm("Log out?", {
                  text: "Your towns stay in your account. Towns in this browser stay here too, and you can log back in anytime.",
                  action: "Log out",
                })
              ) {
                await session.logout();
                close();
                toast.success("Logged out");
              }
            }}
          >
            <SignOut />
            Log out
          </Button>
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
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            placeholder="Your name"
            maxLength={20}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && close(name.trim() || "Guest")}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={async () => (await signIn("room"), close(cloud.user?.username ?? (name.trim() || "Guest")))}>
            Log in
          </Button>
          <Button onClick={() => close(name.trim() || "Guest")}>Join as guest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
