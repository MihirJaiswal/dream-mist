/**
 * Bridge between the game engine and the React interface.
 * The engine never renders DOM itself: it asks the interface to show toasts, dialogue and confirmations.
 * The editor page installs real implementations on mount; the defaults keep the engine usable in tests.
 */

/** Picture beside the dialogue box: large artwork, or a map sprite drawn bigger */
export type Portrait = { src: string; kind: "art" | "sprite" };

/** Toast kinds */
export type ToastType = "info" | "error" | "success" | "warning";

/** Interface callbacks the engine can use */
export type UiBridge = {
  /** Short notification */
  toast(text: string, type?: ToastType): void;
  /** Dialogue box with one or more pages (blank lines split pages), resolves when dismissed */
  say(text: string, options?: { speaker?: string; portrait?: Portrait }): Promise<void>;
  /** Close the dialogue box right away, dropping pending lines (their conversation never continues) */
  hush(): void;
  /** Yes/no question, resolves with the answer */
  confirm(title: string, options?: { text?: string; action?: string; danger?: boolean }): Promise<boolean>;
  /** Ask to sign in (resolves when the window closes, signed in or not) */
  signIn(reason?: SignInReason): Promise<void>;
  /** Create a trainer before playing (resolves when the window closes) */
  onboarding(): Promise<void>;
  /** Name shown to other builders when joining a live room as a guest (empty when declined) */
  guestName(): Promise<string>;
  /** Offer to save towns that only live in this browser to the account */
  bring(cities: { id: string; name: string; width: number; height: number; people: number; updated: number }[]): Promise<void>;
};

/** Why someone is asked to sign in (changes the wording of the sign-in window) */
export type SignInReason = "default" | "save" | "new" | "publish" | "share" | "room" | "upload";

/** Current bridge (replaced by the editor page) */
export const ui: UiBridge = {
  toast: () => {},
  say: async () => {},
  hush: () => {},
  confirm: async () => false,
  signIn: async () => {},
  onboarding: async () => {},
  guestName: async () => "",
  bring: async () => {},
};

/** Install interface callbacks */
export function installUi(bridge: Partial<UiBridge>) {
  Object.assign(ui, bridge);
}
