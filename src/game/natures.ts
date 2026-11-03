/**
 * Natures: each Pokémon has one, raising one stat by 10% and lowering another by 10% (or neither).
 * Stats are numbered like species stats: 1 attack, 2 defense, 3 special attack, 4 special defense, 5 speed.
 */

/** Every nature: the stat it raises and the stat it lowers (the same one for neutral natures) */
export const natures = {
  hardy: [1, 1],
  lonely: [1, 2],
  brave: [1, 5],
  adamant: [1, 3],
  naughty: [1, 4],
  bold: [2, 1],
  docile: [2, 2],
  relaxed: [2, 5],
  impish: [2, 3],
  lax: [2, 4],
  timid: [5, 1],
  hasty: [5, 2],
  serious: [5, 5],
  jolly: [5, 3],
  naive: [5, 4],
  modest: [3, 1],
  mild: [3, 2],
  quiet: [3, 5],
  bashful: [3, 3],
  rash: [3, 4],
  calm: [4, 1],
  gentle: [4, 2],
  sassy: [4, 5],
  careful: [4, 3],
  quirky: [4, 4],
} as const satisfies Record<string, readonly [number, number]>;

/** Nature id */
export type Nature = keyof typeof natures;

/** Every nature id */
export const natureIds = Object.keys(natures) as Nature[];

/** Short stat names, by stat number */
export const statNames = ["HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed"];

/** A random nature */
export function randomNature(random = Math.random): Nature {
  return natureIds[Math.floor(random() * natureIds.length)];
}

/** Multiplier a nature gives a stat (1.1, 0.9 or 1) */
export function natureMultiplier(nature: string | undefined, index: number) {
  const [up, down] = natures[nature as Nature] ?? [0, 0];
  return up === down ? 1 : index === up ? 1.1 : index === down ? 0.9 : 1;
}

/** "Adamant (+Attack, −Sp. Atk)" or "Hardy" */
export function natureLabel(nature: string | undefined) {
  if (!nature || !(nature in natures)) {
    return "";
  }
  const [up, down] = natures[nature as Nature];
  const name = nature[0].toUpperCase() + nature.slice(1);
  return up === down ? name : `${name} (+${statNames[up]}, −${statNames[down]})`;
}
