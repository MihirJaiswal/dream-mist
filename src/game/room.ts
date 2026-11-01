//Imports
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { type City, decode, encode, uid } from "./data";

/** Grid change: [grid, index, value, map id ("" or missing = outside)] */
export type Edit = [string, number, number, string?];

/** Room peer */
export type Peer = { id: string; name: string; color: string; x: number; y: number; joined: number };

/** Room events */
export type RoomHandlers = {
  edit(changes: Edit[], from: string): void;
  meta(patch: Partial<City> & { map?: string }, from: string): void;
  city(city: City, from: string): void;
  peers(peers: Map<string, Peer>): void;
  cursor(peer: Peer): void;
  chat(message: { name: string; color: string; text: string; from: string }): void;
  status(status: "connecting" | "online" | "offline"): void;
  /** This builder became (or stopped being) the one who saves the room */
  host(host: boolean): void;
  /** Someone joined and needs the current city */
  hello(): City | null;
};

/** Builder colors */
const colors = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#eab308", "#14b8a6", "#ef4444"];

/** Edits per message (Realtime messages are limited in size) */
const chunk = 2000;

/**
 * Live building room on Supabase Realtime.
 * Builders join a channel named after the city and its invite (only invite holders know it),
 * see each other through presence, and send edits, people changes, cursors and chat as broadcasts.
 * The builder who has been there the longest is the host: it brings newcomers up to date and saves the city.
 */
export class Room {
  readonly id: string;
  readonly invite: string;
  readonly peers = new Map<string, Peer>();
  readonly you: Peer;
  host = false;
  #channel: RealtimeChannel;
  #outbox = [] as Edit[];
  #timer = 0;
  #cursor = 0;
  readonly #handlers: RoomHandlers;

  constructor({ id, invite, name, handlers }: { id: string; invite: string; name: string; handlers: RoomHandlers }) {
    this.id = id;
    this.invite = invite;
    this.#handlers = handlers;
    const key = uid();
    this.you = { id: key, name: name.slice(0, 20) || "Builder", color: colors[Math.floor(Math.random() * colors.length)], x: -1, y: -1, joined: Date.now() };
    handlers.status("connecting");
    this.#channel = supabase().channel(`room:${id}:${invite}`, { config: { broadcast: { self: false }, presence: { key } } });
    this.#channel
      .on("presence", { event: "sync" }, () => this.#sync())
      .on("broadcast", { event: "edit" }, ({ payload }) => handlers.edit(payload.changes, payload.from))
      .on("broadcast", { event: "meta" }, ({ payload }) => handlers.meta(payload.patch, payload.from))
      .on("broadcast", { event: "city" }, async ({ payload }) => handlers.city(await decode(payload.code), payload.from))
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const peer = this.peers.get(payload.from);
        if (peer) {
          Object.assign(peer, { x: payload.x, y: payload.y });
          handlers.cursor(peer);
        }
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => handlers.chat(payload))
      .on("broadcast", { event: "hello" }, async () => {
        const city = this.host ? handlers.hello() : null;
        if (city) {
          this.city(city);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.#channel.track({ name: this.you.name, color: this.you.color, joined: this.you.joined });
          handlers.status("online");
          this.#send("hello", {});
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          handlers.status("offline");
        }
      });
  }

  /** Invite link */
  get link() {
    return `${location.origin}/editor#room=${this.id}.${this.invite}`;
  }

  /** Rebuild the builders list from presence and pick the host (longest in the room) */
  #sync() {
    const state = this.#channel.presenceState<{ name: string; color: string; joined: number }>();
    const previous = new Map(this.peers);
    this.peers.clear();
    const everyone = [] as { id: string; joined: number }[];
    for (const [id, [presence]] of Object.entries(state)) {
      if (!presence) {
        continue;
      }
      everyone.push({ id, joined: presence.joined });
      if (id !== this.you.id) {
        this.peers.set(id, {
          id,
          name: presence.name,
          color: presence.color,
          joined: presence.joined,
          x: previous.get(id)?.x ?? -1,
          y: previous.get(id)?.y ?? -1,
        });
      }
    }
    everyone.sort((a, b) => a.joined - b.joined || a.id.localeCompare(b.id));
    const host = (everyone[0]?.id ?? this.you.id) === this.you.id;
    if (host !== this.host) {
      this.host = host;
      this.#handlers.host(host);
    }
    this.#handlers.peers(this.peers);
  }

  /** Broadcast a message */
  #send(event: string, payload: Record<string, unknown>) {
    void this.#channel.send({ type: "broadcast", event, payload: { ...payload, from: this.you.id } });
  }

  /** Queue tile edits (sent in batches) */
  edit(changes: Edit[]) {
    this.#outbox.push(...changes);
    if (!this.#timer) {
      this.#timer = setTimeout(() => {
        this.#timer = 0;
        const changes = this.#outbox.splice(0);
        for (let i = 0; i < changes.length; i += chunk) {
          this.#send("edit", { changes: changes.slice(i, i + chunk) });
        }
      }, 60) as unknown as number;
    }
  }

  /** Send a partial city update (`map` targets an interior for people, spawn and doors) */
  meta(patch: Partial<City> & { map?: string }) {
    this.#send("meta", { patch });
  }

  /** Send the whole city (resize, import, newcomers), compressed */
  async city(city: City) {
    this.#send("city", { code: await encode(city) });
  }

  /** Send the cursor position (throttled) */
  cursor(x: number, y: number) {
    const now = performance.now();
    if (now - this.#cursor > 80) {
      this.#cursor = now;
      this.#send("cursor", { x, y });
    }
  }

  /** Send a chat message */
  chat(text: string) {
    const message = { name: this.you.name, color: this.you.color, text: text.slice(0, 300) };
    this.#send("chat", message);
    this.#handlers.chat({ ...message, from: this.you.id });
  }

  /** Leave the room */
  close() {
    void supabase().removeChannel(this.#channel);
  }
}
