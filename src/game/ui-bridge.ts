/**
 * Bridge between the game engine and the React interface.
 * The engine never renders DOM itself: it asks the interface to show toasts, dialogue and confirmations.
 * The editor page installs real implementations on mount; the defaults keep the engine usable in tests.
 */

import type { ItemId } from "./items";
import type { Creature } from "./trainer";

/** Picture beside the dialogue box: large artwork, or a map sprite drawn bigger */
export type Portrait = { src: string; kind: "art" | "sprite" };

/** Story or quest banner */
export type Banner = { title: string; text: string; kind: "story" | "quest" | "place" };

/** Toast kinds */
export type ToastType = "info" | "error" | "success" | "warning";

/** Interface callbacks the engine can use */
export type UiBridge = {
  /** Short notification */
  toast(text: string, type?: ToastType): void;
  /** Dialogue box with one or more pages (blank lines split pages), resolves when dismissed */
  say(text: string, options?: { speaker?: string; portrait?: Portrait }): Promise<void>;
  /** Ask a YES/NO question in the dialogue box, resolves with the answer */
  ask(text: string, options?: { speaker?: string; portrait?: Portrait }): Promise<boolean>;
  /** Pick one of a few answers in the dialogue box (the last one is the way out), resolves with its index */
  choose(text: string, choices: string[], options?: { speaker?: string; portrait?: Portrait }): Promise<number>;
  /** Start menu (Pokédex, Pokémon, Bag…), resolves when it closes */
  menu(): Promise<void>;
  /** Party screen to choose a Pokémon (switching in battle): resolves with its index, null when cancelled */
  party(pick: { message: string; action?: string; can?: (creature: Creature, index: number) => true | string; cancel?: boolean }): Promise<number | null>;
  /** Bag screen in battle: resolves with the item to use, null when closed */
  bag(options: { battle: { usable: (id: ItemId) => boolean } }): Promise<ItemId | null>;
  /** Close the dialogue box right away, dropping pending lines (their conversation never continues) */
  hush(): void;
  /** Poké Mart: buy items with the trainer's money (resolves when they leave) */
  shop(stock: ItemId[], options?: { speaker?: string; portrait?: Portrait }): Promise<void>;
  /** Big banner at the top of the screen for a moment (story progress, quests) */
  banner(banner: Banner): void;
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
  ask: async () => false,
  choose: async (_text, choices) => choices.length - 1,
  menu: async () => {},
  party: async () => null,
  bag: async () => null,
  hush: () => {},
  shop: async () => {},
  banner: () => {},
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
