/** Items in the bag: Poké Balls, healing and cures. Sold by Poké Mart clerks, handed out by people and story rewards */
export const items = {
  "poke-ball": { name: "Poké Ball", price: 200, kind: "ball", rate: 1, about: "Catches wild Pokémon" },
  "great-ball": { name: "Great Ball", price: 600, kind: "ball", rate: 1.5, about: "Catches better than a Poké Ball" },
  potion: { name: "Potion", price: 300, kind: "heal", amount: 20, about: "Restores 20 HP" },
  "super-potion": { name: "Super Potion", price: 700, kind: "heal", amount: 50, about: "Restores 50 HP" },
  "full-heal": { name: "Full Heal", price: 600, kind: "cure", about: "Wakes up and cures poison, paralysis and burns" },
} as const satisfies Record<string, { name: string; price: number; kind: "ball" | "heal" | "cure"; rate?: number; amount?: number; about: string }>;

/** Item id */
export type ItemId = keyof typeof items;

/** Every item, in shop order */
export const itemIds = Object.keys(items) as ItemId[];

/** Is a string an item id */
export function isItem(id: string): id is ItemId {
  return id in items;
}

/** "3 Potions", "a Great Ball" */
export function itemCount(id: ItemId, count: number) {
  const { name } = items[id];
  return count === 1 ? `${/^[AEIOU]/i.test(name) ? "an" : "a"} ${name}` : `${count} ${name}s`;
}
