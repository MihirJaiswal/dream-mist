//Imports
import * as PIXI from "pixi.js";

/** Weather of a map */
export type Weather = "clear" | "rain" | "snow" | "fog" | "sandstorm";

/** Time of day of a map ("clock" follows the player's own clock) */
export type Daytime = "morning" | "day" | "evening" | "night" | "clock";

/** Time of day shown, once the clock is read */
export type Hour = Exclude<Daytime, "clock">;

/** Part of the day wild Pokémon go by: evenings count as day */
export type Period = "morning" | "day" | "night";

export const weathers: { key: Weather; label: string }[] = [
  { key: "clear", label: "Clear" },
  { key: "rain", label: "Rain" },
  { key: "snow", label: "Snow" },
  { key: "fog", label: "Fog" },
  { key: "sandstorm", label: "Sandstorm" },
];

export const daytimes: { key: Daytime; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "day", label: "Day" },
  { key: "evening", label: "Evening" },
  { key: "night", label: "Night" },
  { key: "clock", label: "Follows the clock" },
];

/** Time of day right now on the player's clock: morning 4 to 10, day until 17, evening until 20, then night */
export function clock(date = new Date()): Hour {
  const hour = date.getHours();
  return hour >= 4 && hour < 10 ? "morning" : hour >= 10 && hour < 17 ? "day" : hour >= 17 && hour < 20 ? "evening" : "night";
}

/** Time of day shown on a map (reads the clock when the map follows it) */
export function hour(time: Daytime = "day", date = new Date()): Hour {
  return time === "clock" ? clock(date) : time;
}

/** Part of the day for wild Pokémon */
export function period(time: Daytime = "day", date = new Date()): Period {
  const now = hour(time, date);
  return now === "evening" ? "day" : now;
}

/** Tint of each time of day, and of weathers that color the air */
const tints = {
  morning: [0xffd2a0, 0.12],
  evening: [0xff6a20, 0.26],
  night: [0x0b1840, 0.48],
  rain: [0x5070a0, 0.12],
  fog: [0xdfe6ec, 0.32],
  sandstorm: [0xc8a060, 0.22],
} as Record<string, [number, number]>;

/** One falling raindrop, snowflake, grain of sand or patch of fog */
type Particle = { x: number; y: number; speed: number; size: number; phase: number };

/**
 * Weather and time of day, drawn over the map in screen space (play mode).
 * Particles live in a fixed number and wrap around the screen, so the cost stays the same on any map.
 */
export class Atmosphere {
  readonly #app: PIXI.Application;
  readonly #layer = new PIXI.Container();
  readonly #tint = new PIXI.Graphics();
  readonly #particles = new PIXI.Graphics();
  #weather = "clear" as Weather;
  #time = "day" as Daytime;
  #drops = [] as Particle[];
  #clock = 0;
  readonly #ticker = (dt: number) => this.#update(dt);

  constructor(app: PIXI.Application, weather: Weather = "clear", time: Daytime = "day") {
    this.#app = app;
    this.#layer.addChild(this.#tint, this.#particles);
    this.#layer.interactiveChildren = false;
    app.stage.addChild(this.#layer);
    app.ticker.add(this.#ticker);
    this.set(weather, time);
  }

  /** Change the weather and time of day */
  set(weather: Weather = "clear", time: Daytime = "day") {
    this.#weather = weather;
    this.#time = hour(time);
    const count = { clear: 0, rain: 140, snow: 90, fog: 7, sandstorm: 120 }[weather] ?? 0;
    const { width, height } = this.#app.screen;
    this.#drops = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 0.6 + Math.random() * 0.8,
      size: Math.random(),
      phase: Math.random() * Math.PI * 2,
    }));
    this.#update(0);
  }

  /** Remove from the map */
  destroy() {
    this.#app.ticker.remove(this.#ticker);
    this.#layer.destroy({ children: true });
  }

  /** Draw a frame */
  #update(dt: number) {
    const { width, height } = this.#app.screen;
    this.#clock += dt;

    //Tints: time of day, then the weather's own color on top
    this.#tint.clear();
    for (const key of [this.#time, this.#weather]) {
      const tint = tints[key];
      if (tint) {
        this.#tint.beginFill(tint[0], tint[1]).drawRect(0, 0, width, height).endFill();
      }
    }

    const g = this.#particles;
    g.clear();
    const wrap = (drop: Particle) => {
      if (drop.y > height + 20) {
        drop.y = -20;
        drop.x = Math.random() * width;
      }
      if (drop.x > width + 40) {
        drop.x = -40;
        drop.y = Math.random() * height;
      }
      if (drop.x < -40) {
        drop.x = width + 40;
      }
    };
    switch (this.#weather) {
      case "rain": {
        g.lineStyle({ width: 1.5, color: 0xb8d0ff, alpha: 0.55 });
        for (const drop of this.#drops) {
          drop.x += 2.5 * dt;
          drop.y += (14 + drop.speed * 8) * dt;
          wrap(drop);
          g.moveTo(drop.x, drop.y).lineTo(drop.x - 4, drop.y - 14 - drop.size * 8);
        }
        break;
      }
      case "snow": {
        for (const drop of this.#drops) {
          drop.y += (0.8 + drop.speed) * dt;
          drop.x += Math.sin(this.#clock / 40 + drop.phase) * 0.6 * dt;
          wrap(drop);
          g.beginFill(0xffffff, 0.85)
            .drawCircle(drop.x, drop.y, 1.2 + drop.size * 2)
            .endFill();
        }
        break;
      }
      case "fog": {
        for (const drop of this.#drops) {
          drop.x += (0.15 + drop.speed * 0.2) * dt;
          wrap(drop);
          g.beginFill(0xffffff, 0.09)
            .drawEllipse(drop.x, drop.y, 180 + drop.size * 160, 60 + drop.size * 50)
            .endFill();
        }
        break;
      }
      case "sandstorm": {
        g.lineStyle({ width: 1.5, color: 0xe8c890, alpha: 0.5 });
        for (const drop of this.#drops) {
          drop.x += (12 + drop.speed * 8) * dt;
          drop.y += Math.sin(this.#clock / 20 + drop.phase) * dt;
          wrap(drop);
          g.moveTo(drop.x, drop.y).lineTo(drop.x - 10 - drop.size * 14, drop.y);
        }
        break;
      }
    }
  }
}
