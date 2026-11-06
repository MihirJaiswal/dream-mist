"use client";

/**
 * The login window, in DreamMist's pixel night: Google, or a sign-in link by email.
 * The editor opens it when something needs an account; the website opens it from "Log in" and likes (through `openLogin`).
 * Either way the player comes back to the page they were on, signed in.
 */

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { loginWithEmail, loginWithGoogle } from "@/lib/api";
import { configured } from "@/lib/supabase";
import type { SignInReason } from "@/game/ui-bridge";
import { type FormEvent, useState, useSyncExternalStore } from "react";

/** Why someone is asked to log in (changes the wording) */
export type LoginReason = SignInReason | "like";

const reasons: Record<LoginReason, { title: string; text: string }> = {
  default: { title: "Welcome, trainer!", text: "Log in to keep your games and your trainer safe, and take them to any device." },
  save: { title: "Keep your towns safe", text: "Right now your towns only live in this browser. Log in to save them to your account." },
  new: { title: "Keep your towns safe", text: "Log in before starting a new town, so both are saved to your account." },
  publish: { title: "Log in to publish", text: "Published games belong to an account, so you can update them and see their likes." },
  share: { title: "Log in for short links", text: "Games in your account get short links that always show your latest version." },
  room: { title: "Log in to build together", text: "Live rooms are saved in your account, so everyone's changes are kept." },
  upload: { title: "Log in to upload", text: "Uploads go to your account, so images can be bigger and share links stay short." },
  like: { title: "Log in to like games", text: "Likes belong to an account, so the games you love are easy to find again." },
};

/** What an account gives, each with a Poké Ball */
const perks = [
  { ball: "ball-poke", text: "Your games and trainer on every device" },
  { ball: "ball-great", text: "Publish to Explore and collect likes" },
  { ball: "ball-dream", text: "Build the same game live with friends" },
];

/** Google "G" in its four colors */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Readable reason a login failed */
function failure(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /rate limit/i.test(text) ? "Too many emails were sent for now. Try again in a little while, or continue with Google." : text;
}

/** The login window. `prepare` runs before leaving the page (the editor saves the town first) */
export function LoginWindow({ reason = "default", onClose, prepare }: { reason?: LoginReason; onClose: () => void; prepare?: () => Promise<void> }) {
  const [busy, setBusy] = useState<"" | "google" | "email">("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const google = async () => {
    setBusy("google");
    setError("");
    try {
      await prepare?.();
      await loginWithGoogle();
    } catch (problem) {
      setError(failure(problem));
      setBusy("");
    }
  };
  const mail = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      return setError("That doesn't look like an email address.");
    }
    setBusy("email");
    setError("");
    try {
      await prepare?.();
      await loginWithEmail(address);
      setSent(address);
    } catch (problem) {
      setError(failure(problem));
    }
    setBusy("");
  };
  const { title, text } = reasons[reason];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92svh] w-[calc(100%-2rem)] max-w-[420px] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-[420px]"
      >
        <div className="border-4 border-[#0b0616] bg-[#1d1038] text-white shadow-[inset_0_4px_0_#3f2c74,8px_8px_0_#0b0616]">
          <div className="h-1.5 bg-[#f06aa6]" aria-hidden="true" />
          {/* The dream sky, Musharna floating in it */}
          <div className="relative h-32 overflow-hidden border-b-4 border-[#0b0616]">
            <div className="pixelated absolute inset-0 bg-[url(/site/herobg.avif)] bg-cover bg-[center_60%]" aria-hidden="true" />
            <div className="absolute inset-0 bg-[rgb(20_11_42/0.45)]" aria-hidden="true" />
            {[
              [12, 22],
              [28, 62],
              [70, 18],
              [86, 54],
              [52, 12],
            ].map(([x, y]) => (
              <span
                key={`${x}-${y}`}
                className="twinkle absolute size-1 bg-white"
                style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${x / 40}s` }}
                aria-hidden="true"
              />
            ))}
            <img
              src="/site/sprites/anim-518.gif"
              alt=""
              width={154}
              height={148}
              className="pixelated float absolute bottom-1 left-1/2 h-28 w-auto -translate-x-1/2"
            />
            <button
              onClick={onClose}
              aria-label="Close"
              className="stepped absolute right-3 top-3 grid size-8 place-items-center bg-[#0b0616]/70 font-pixel text-[14px] text-[#c9b8f5] hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-6">
            {sent ? (
              <div className="text-center">
                <img src="/game/items/dream_mail.png" alt="" width={24} height={24} className="pixelated mx-auto size-12" />
                <DialogTitle className="mt-3 font-pixel text-[18px] leading-snug text-white">Check your inbox</DialogTitle>
                <DialogDescription className="mt-3 font-game text-[15px] leading-relaxed text-[#c9b8f5]">
                  We sent a sign-in link to <b className="font-medium text-white">{sent}</b>. Open it on this device and you&apos;ll be back here, logged in.
                </DialogDescription>
                <p className="mt-4 font-game text-[13px] text-[#9b8cc9]">Nothing after a minute? Look in your spam folder.</p>
                <button onClick={() => setSent("")} className="mt-5 font-pixel text-[11px] uppercase tracking-wide text-[#f06aa6] hover:text-white">
                  Use another way
                </button>
              </div>
            ) : (
              <>
                <p className="font-pixel text-[11px] uppercase tracking-wide text-[#f06aa6]">Trainer login</p>
                <DialogTitle className="mt-1.5 text-balance font-pixel text-[20px] leading-snug text-white">{title}</DialogTitle>
                <DialogDescription className="mt-2 font-game text-[15px] leading-relaxed text-[#c9b8f5]">{text}</DialogDescription>
                <ul className="mt-4 grid gap-1.5">
                  {perks.map(({ ball, text }) => (
                    <li key={ball} className="flex items-center gap-2.5 font-game text-[14px] text-[#e8e3f7]">
                      <img src={`/site/sprites/${ball}.png`} alt="" width={16} height={16} className="pixelated size-5" />
                      {text}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={google}
                  disabled={Boolean(busy)}
                  className="mt-6 flex w-full items-center justify-center gap-3 border-4 border-[#0b0616] bg-[#f8f8f8] px-4 py-3 font-pixel text-[12px] uppercase tracking-wide text-[#1c1240] shadow-[4px_4px_0_#0b0616] transition-[translate,box-shadow] duration-100 ease-[steps(2)] hover:-translate-y-0.5 hover:shadow-[4px_6px_0_#0b0616] disabled:opacity-60"
                >
                  <GoogleLogo />
                  {busy === "google" ? "Opening Google…" : "Continue with Google"}
                </button>

                <div className="my-5 flex items-center gap-3 font-pixel text-[10px] uppercase text-[#9b8cc9]" aria-hidden="true">
                  <span className="h-[3px] flex-1 bg-[#3f2c74]" />
                  or
                  <span className="h-[3px] flex-1 bg-[#3f2c74]" />
                </div>

                <form onSubmit={mail} noValidate className="grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="font-game text-[13px] text-[#c9b8f5]">Email me a sign-in link</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="border-4 border-[#0b0616] bg-[#0e0820] px-3 py-2.5 font-game text-[15px] text-white outline-none placeholder:text-[#6a5a9a] focus:border-[#b9a6ff]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={Boolean(busy)}
                    className="border-4 border-[#0b0616] bg-[#b9a6ff] px-4 py-2.5 font-pixel text-[12px] uppercase tracking-wide text-[#1c1240] shadow-[4px_4px_0_#0b0616] transition-[translate,box-shadow] duration-100 ease-[steps(2)] hover:-translate-y-0.5 hover:shadow-[4px_6px_0_#0b0616] disabled:opacity-60"
                  >
                    {busy === "email" ? "Sending…" : "Send the link"}
                  </button>
                </form>

                {error ? (
                  <p role="alert" className="mt-4 border-l-4 border-[#f05038] bg-[#f05038]/10 px-3 py-2 font-game text-[13px] text-[#ffb4a8]">
                    {error}
                  </p>
                ) : null}
                <p className="mt-5 text-center font-game text-[12px] leading-relaxed text-[#9b8cc9]">
                  Your towns in this browser stay here either way. After logging in you can bring them into your account.
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

//=================================================================================================
// The website's login window (opened from anywhere on the site)

let open = null as LoginReason | null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));

/** Open the login window on the website (nothing happens without online features: nothing offers to log in then) */
export function openLogin(reason: LoginReason = "default") {
  if (!configured) {
    return;
  }
  open = reason;
  listeners.forEach((listener) => listener());
}

/** Shows the website's login window when it's opened (mounted once in the site layout) */
export function LoginHost() {
  const reason = useSyncExternalStore(
    subscribe,
    () => open,
    () => null,
  );
  return reason ? (
    <LoginWindow
      reason={reason}
      onClose={() => {
        open = null;
        listeners.forEach((listener) => listener());
      }}
    />
  ) : null;
}
