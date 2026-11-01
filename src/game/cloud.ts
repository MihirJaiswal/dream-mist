//Imports
import type { City } from "./data";
import { configured, supabase } from "@/lib/supabase";

/** Public details of a saved city (yours, shared with you, or on Explore) */
export type Card = {
  id: string;
  name: string;
  owner: string;
  author: string;
  description: string;
  thumb: string;
  width: number;
  height: number;
  interiors: number;
  story: number;
  published: boolean;
  publishedAt: number;
  updated: number;
  plays: number;
  forks: number;
  likes: number;
  mine: boolean;
  liked?: boolean;
  forkOf?: null | { id: string; name: string; owner: string };
};

/** Upload kinds and their size limits */
const uploads = { tileset: 4 * 1024 * 1024, sprite: 1024 * 1024, battle: 4 * 1024 * 1024, music: 12 * 1024 * 1024, thumb: 1024 * 1024 } as const;

/** Turn a Supabase error into a readable one */
function fail(error: { message: string } | null): never {
  throw new Error(error?.message ?? "Something went wrong, please try again");
}

/**
 * Online features on Supabase: accounts, saved cities, Explore, likes, forks and uploads.
 * Without a Supabase project `available` stays false and DreamMist works offline with browser saves.
 */
export const cloud = {
  /** Supabase set up */
  available: configured,

  /** Signed-in account */
  user: null as null | { id: string; username: string; email: string },

  /** Sign-in state listeners */
  listeners: new Set<() => void>(),

  /** Notify listeners */
  changed() {
    this.listeners.forEach((listener) => listener());
  },

  /** Load the current session and follow sign-ins and sign-outs (also finishes Google sign-in on return) */
  async init() {
    if (!this.available) {
      return this.changed();
    }
    const { data } = await supabase().auth.getSession();
    await this.load(data.session?.user ?? null);
    supabase().auth.onAuthStateChange((_, session) => {
      //Fires inside Supabase's own lock: load the profile afterwards
      setTimeout(() => this.load(session?.user ?? null), 0);
    });
  },

  /** Read the profile of an account (internal) */
  async load(account: null | { id: string; email?: string }) {
    if (!account) {
      if (this.user) {
        this.user = null;
        this.changed();
      }
      return;
    }
    if (this.user?.id === account.id) {
      return;
    }
    const { data } = await supabase().from("profiles").select("username").eq("id", account.id).maybeSingle();
    this.user = { id: account.id, username: data?.username ?? "trainer", email: account.email ?? "" };
    this.changed();
  },

  /** Continue with Google (leaves the page, Supabase brings the player back to the editor) */
  async google() {
    const { error } = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/editor` } });
    if (error) {
      fail(error);
    }
  },

  /** Log out */
  async logout() {
    await supabase().auth.signOut();
    this.user = null;
    this.changed();
  },

  /** Trainer progress (party, badges, story progress) */
  trainer: {
    async get() {
      const { data } = await supabase().from("trainers").select("data").eq("user_id", cloud.user!.id).maybeSingle();
      return data?.data ?? null;
    },
    async put(trainer: unknown) {
      const { error } = await supabase().from("trainers").upsert({ user_id: cloud.user!.id, data: trainer });
      if (error) {
        fail(error);
      }
    },
  },

  /** Saved cities */
  cities: {
    /** Cities you own or build on */
    async list() {
      const { data, error } = await supabase().rpc("my_cities");
      return error ? fail(error) : data as Card[];
    },
    /** Save a new city to your account */
    async create(city: City) {
      const { data, error } = await supabase().from("cities").insert({ name: city.name.slice(0, 40), author: city.author.slice(0, 40), width: city.width, height: city.height, data: city }).select("id, invite").single();
      if (error) {
        fail(error);
      }
      //The saved copy carries its new id
      await supabase().from("cities").update({ data: { ...city, id: data.id } }).eq("id", data.id);
      return data as { id: string; invite: string };
    },
    /** Open a city from its id (anyone can play it, builders can edit it) */
    async get(id: string) {
      const { data, error } = await supabase().rpc("get_city", { city_id: id });
      if (error) {
        fail(error);
      }
      if (!data) {
        throw new Error("This city doesn't exist anymore");
      }
      return data as { city: City; meta: Card; editable: boolean; invite: string | null };
    },
    /** Save changes (owners and builders, or anyone holding the invite of a live room) */
    async save(id: string, city: City, invite = "") {
      const { data, error } = await supabase().rpc("save_city", { city_id: id, invite_code: invite, city });
      return error ? fail(error) : data as Card;
    },
    async remove(id: string) {
      const { error } = await supabase().from("cities").delete().eq("id", id);
      if (error) {
        fail(error);
      }
    },
    /** Publish (or update) a city on Explore */
    async publish(id: string, description: string, thumb = "") {
      const { error } = await supabase().from("cities").update({ published: true, published_at: new Date().toISOString(), description: description.slice(0, 500), ...(thumb ? { thumb } : {}) }).eq("id", id);
      if (error) {
        fail(error);
      }
      return (await this.get(id)).meta;
    },
    async unpublish(id: string) {
      const { error } = await supabase().from("cities").update({ published: false }).eq("id", id);
      if (error) {
        fail(error);
      }
    },
    /** Copy a city into your account (credits the original) */
    async fork(id: string) {
      const { data, error } = await supabase().rpc("fork_city", { city_id: id });
      return error ? fail(error) : data as Card & { invite: string };
    },
    async like(id: string) {
      const { data, error } = await supabase().rpc("toggle_like", { city_id: id });
      return error ? fail(error) : data as { liked: boolean; likes: number };
    },
    async play(id: string) {
      await supabase().rpc("count_play", { city_id: id });
    },
    async explore() {
      const { data, error } = await supabase().rpc("explore");
      return error ? fail(error) : data as Card[];
    },
    /** Become a builder of a city with its invite */
    async join(id: string, invite: string) {
      const { data, error } = await supabase().rpc("join_city", { city_id: id, invite_code: invite });
      return error ? fail(error) : Boolean(data);
    },
    /** Earlier versions of a city you own or build, newest first */
    async versions(id: string) {
      const { data, error } = await supabase().rpc("city_versions", { town: id });
      return error ? fail(error) : (data as { id: number; name: string; saved_at: string; size: number }[]).map(({ id, name, saved_at, size }) => ({ id, name, saved: Date.parse(saved_at), size }));
    },
    /** Bring a city back to an earlier version (the current one is kept as a version too) */
    async restore(version: number) {
      const { error } = await supabase().rpc("restore_version", { version });
      return error ? fail(error) : true;
    },
    /** Invite code of a city you own (a new one stops old links from working) */
    async invite(id: string, regenerate = false) {
      if (regenerate) {
        const { data, error } = await supabase().rpc("reset_invite", { city_id: id });
        return error ? fail(error) : data as string;
      }
      const { data, error } = await supabase().from("cities").select("invite").eq("id", id).single();
      return error ? fail(error) : data.invite as string;
    },
  },

  /** Upload a tileset, sprite, music file or Explore thumbnail, resolves with its public url */
  async upload(file: Blob, kind: keyof typeof uploads, name = "") {
    if (!this.user) {
      throw new Error("Log in to upload files");
    }
    if (file.size > uploads[kind]) {
      throw new Error(`This file is too big (${Math.ceil(uploads[kind] / 1024 / 1024)} MB at most)`);
    }
    const extension = (file.type.split("/")[1] ?? "bin").replace("mpeg", "mp3").replace("x-m4a", "m4a").replace(/[^a-z0-9]/g, "");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || kind;
    const path = `${this.user.id}/${kind}/${Date.now().toString(36)}-${slug}.${extension}`;
    const { error } = await supabase().storage.from("assets").upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      fail(error);
    }
    return { url: supabase().storage.from("assets").getPublicUrl(path).data.publicUrl };
  },
};

/** Is an identifier a saved city id (10 lowercase letters and digits) */
export function isCloudId(id: string) {
  return /^[a-z0-9]{10}$/.test(id);
}
