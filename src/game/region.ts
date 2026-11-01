/**
 * Region: the outside map and outdoor maps (routes, other towns) placed on one grid, joined where their edges touch.
 * Positions are in tiles. The outside map always sits at 0, 0; outdoor maps keep their `region` position.
 * Walking off the edge of one outdoor map lands on the map touching it there.
 */

//Imports
import type { City } from "./data";

/** An outdoor map and where it sits on the region grid */
export type Placed = { map: City; x: number; y: number };

/** Is a map part of the region (the outside map, or an outdoor map) */
export function isOutdoor(world: City, map: City) {
  return (map === world) || (Boolean(map.outdoor));
}

/** Every map of the region with its position */
export function outdoors(world: City): Placed[] {
  return [{ map: world, x: 0, y: 0 }, ...world.interiors.filter(({ outdoor }) => outdoor).map((map) => ({ map, x: map.region?.x ?? 0, y: map.region?.y ?? 0 }))];
}

/** Position of a map on the region grid (null for interiors) */
export function placement(world: City, map: City) {
  return outdoors(world).find((placed) => placed.map === map) ?? null;
}

/** Do two rectangles overlap */
function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return (a.x < b.x + b.w) && (b.x < a.x + a.w) && (a.y < b.y + b.h) && (b.y < a.y + a.h);
}

/** Would a map at this position overlap another map of the region */
export function collides(world: City, map: City, x: number, y: number) {
  const rect = { x, y, w: map.width, h: map.height };
  return outdoors(world).some((other) => (other.map !== map) && (overlap(rect, { x: other.x, y: other.y, w: other.map.width, h: other.map.height })));
}

/** Shared edge of two placed maps: the tiles of `a` along it, and the step from `a` into `b` (null when they don't touch) */
export function edge(a: Placed, b: Placed) {
  const [aw, ah, bw, bh] = [a.map.width, a.map.height, b.map.width, b.map.height];
  const span = (from: number, to: number, start: number, end: number) => ({ start: Math.max(from, start), end: Math.min(to, end) });
  const sides = [
    { touch: a.x + aw === b.x, dx: 1, dy: 0, along: span(a.y, a.y + ah, b.y, b.y + bh), fixed: aw - 1 },
    { touch: b.x + bw === a.x, dx: -1, dy: 0, along: span(a.y, a.y + ah, b.y, b.y + bh), fixed: 0 },
    { touch: a.y + ah === b.y, dx: 0, dy: 1, along: span(a.x, a.x + aw, b.x, b.x + bw), fixed: ah - 1 },
    { touch: b.y + bh === a.y, dx: 0, dy: -1, along: span(a.x, a.x + aw, b.x, b.x + bw), fixed: 0 },
  ];
  const side = sides.find(({ touch, along }) => (touch) && (along.end > along.start));
  if (!side) {
    return null;
  }
  //Tiles of `a` on the shared edge, in a's own coordinates
  const tiles = [] as { x: number; y: number }[];
  for (let i = side.along.start; i < side.along.end; i++) {
    tiles.push(side.dx ? { x: side.fixed, y: i - a.y } : { x: i - a.x, y: side.fixed });
  }
  return { dx: side.dx, dy: side.dy, tiles };
}

/** Maps touching a map, with their offset from it in tiles */
export function neighbors(world: City, map: City) {
  const self = placement(world, map);
  if (!self) {
    return [];
  }
  return outdoors(world).filter((other) => (other.map !== map) && (edge(self, other))).map((other) => ({ map: other.map, dx: other.x - self.x, dy: other.y - self.y }));
}

/** Where a step off the edge of a map lands: the map there and the tile on it (null when nothing is there) */
export function crossing(world: City, map: City, x: number, y: number) {
  const self = placement(world, map);
  if ((!self) || ((x >= 0) && (y >= 0) && (x < map.width) && (y < map.height))) {
    return null;
  }
  const [wx, wy] = [self.x + x, self.y + y];
  const target = outdoors(world).find((other) => (other.map !== map) && (wx >= other.x) && (wy >= other.y) && (wx < other.x + other.map.width) && (wy < other.y + other.map.height));
  return target ? { map: target.map, x: wx - target.x, y: wy - target.y } : null;
}

/** Can the player cross a map edge on this tile: not blocked, and not under a tree top (tree borders let the player walk behind their tops) */
export function walkable(map: City, x: number, y: number) {
  const index = y * map.width + x;
  return (!map.solid[index]) && (!map.layers.above[index]);
}

/** Maps of the region the player can walk to from the outside map (touching, through a tile open on both sides) */
export function reachable(world: City) {
  const placed = outdoors(world);
  const seen = new Set<City>([world]);
  const queue = [placed[0]];
  while (queue.length) {
    const a = queue.shift()!;
    for (const b of placed) {
      if (seen.has(b.map)) {
        continue;
      }
      const shared = edge(a, b);
      if (shared?.tiles.some(({ x, y }) => (walkable(a.map, x, y)) && (walkable(b.map, x + a.x - b.x + shared.dx, y + a.y - b.y + shared.dy)))) {
        seen.add(b.map);
        queue.push(b);
      }
    }
  }
  return seen;
}

/** Side of a map */
export type Side = "up" | "right" | "down" | "left";

/** Free spot touching a map, on the preferred side first (centered along it) */
export function spot(world: City, next: { width: number; height: number }, beside: City, sides: readonly Side[] = ["up", "right", "down", "left"]) {
  const self = placement(world, beside) ?? outdoors(world)[0];
  const probe = { ...next } as City;
  for (const side of sides) {
    const x = side === "right" ? self.x + self.map.width : side === "left" ? self.x - next.width : self.x + Math.floor((self.map.width - next.width) / 2);
    const y = side === "down" ? self.y + self.map.height : side === "up" ? self.y - next.height : self.y + Math.floor((self.map.height - next.height) / 2);
    if (!collides(world, probe, x, y)) {
      return { x, y, side };
    }
  }
  return null;
}
