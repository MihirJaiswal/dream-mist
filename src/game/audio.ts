//Imports
import { storage } from "./data";

/** Music tracks */
const tracks = { town: "/game/audio/town.m4a", battle: "/game/audio/battle.m4a" } as const;

/** Sound effects */
const effects = { hit: "/game/audio/hit.m4a", hit2: "/game/audio/hit2.m4a", victory: "/game/audio/victory.m4a" } as const;

/** Audio player */
export const sound = {
  /** Muted state */
  muted: storage.get("muted", false),

  /** Current music */
  current: null as null | HTMLAudioElement,

  /** Current track url */
  track: "",

  /** Custom tracks of the current city */
  custom: {} as { town?: string; battle?: string },

  /** Play a music track (loops) */
  music(name: keyof typeof tracks) {
    const url = this.custom[name] || tracks[name];
    if (this.track === url) {
      return;
    }
    this.current?.pause();
    this.track = url;
    this.current = Object.assign(new Audio(url), { loop: true, volume: 0.35 });
    if (!this.muted) {
      this.current.play().catch(() => null);
    }
  },

  /** Play a sound effect */
  play(name: keyof typeof effects) {
    if (!this.muted) {
      Object.assign(new Audio(effects[name]), { volume: 0.5 }).play().catch(() => null);
    }
  },

  /** Stop music */
  stop() {
    this.current?.pause();
    this.current = null;
    this.track = "";
  },

  /** Toggle mute */
  toggle() {
    this.muted = !this.muted;
    storage.set("muted", this.muted);
    if (this.muted) {
      this.current?.pause();
    } else {
      this.current?.play().catch(() => null);
    }
    return this.muted;
  },
};
