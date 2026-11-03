/** Items in the bag: Poké Balls, healing, cures and key items. Sold by Poké Mart clerks (key items cost nothing and aren't sold), handed out by people and story rewards */
export const items = {
  "poke-ball": { name: "Poké Ball", price: 200, kind: "ball", rate: 1, about: "Catches wild Pokémon" },
  "great-ball": { name: "Great Ball", price: 600, kind: "ball", rate: 1.5, about: "Catches better than a Poké Ball" },
  potion: { name: "Potion", price: 300, kind: "heal", amount: 20, about: "Restores 20 HP" },
  "super-potion": { name: "Super Potion", price: 700, kind: "heal", amount: 50, about: "Restores 50 HP" },
  "full-heal": { name: "Full Heal", price: 600, kind: "cure", about: "Wakes up and cures poison, paralysis and burns" },
  "old-rod": { name: "Old Rod", price: 0, kind: "rod", tier: 0, about: "Fish while facing water" },
  "good-rod": { name: "Good Rod", price: 0, kind: "rod", tier: 1, about: "Fish while facing water. Hooks more Pokémon than the Old Rod" },
  "super-rod": { name: "Super Rod", price: 0, kind: "rod", tier: 2, about: "Fish while facing water. Hooks every Pokémon that lives there" },
  "hm-flash": { name: "HM05 Flash", price: 0, kind: "hm", about: "Lights up dark caves" },
  "oran-berry": { name: "Oran Berry", price: 100, kind: "hold", heal: 10, about: "Held: restores 10 HP when HP falls to half" },
  "sitrus-berry": { name: "Sitrus Berry", price: 400, kind: "hold", heal: 0.25, about: "Held: restores 1/4 of HP when HP falls to half" },
  "lum-berry": { name: "Lum Berry", price: 500, kind: "hold", about: "Held: cures any condition once" },
  leftovers: { name: "Leftovers", price: 4000, kind: "hold", about: "Held: restores a little HP every turn" },
  "quick-claw": { name: "Quick Claw", price: 2000, kind: "hold", about: "Held: sometimes moves first" },
  charcoal: { name: "Charcoal", price: 1000, kind: "hold", boosts: "fire", about: "Held: Fire moves get 20% stronger" },
  "mystic-water": { name: "Mystic Water", price: 1000, kind: "hold", boosts: "water", about: "Held: Water moves get 20% stronger" },
  "miracle-seed": { name: "Miracle Seed", price: 1000, kind: "hold", boosts: "grass", about: "Held: Grass moves get 20% stronger" },
  magnet: { name: "Magnet", price: 1000, kind: "hold", boosts: "electric", about: "Held: Electric moves get 20% stronger" },
  "silk-scarf": { name: "Silk Scarf", price: 1000, kind: "hold", boosts: "normal", about: "Held: Normal moves get 20% stronger" },
} as const satisfies Record<
  string,
  {
    name: string;
    price: number;
    kind: "ball" | "heal" | "cure" | "rod" | "hm" | "hold";
    heal?: number;
    boosts?: string;
    rate?: number;
    amount?: number;
    tier?: number;
    about: string;
  }
>;

/** Item id */
export type ItemId = keyof typeof items;

/** Every item, in shop order */
export const itemIds = Object.keys(items) as ItemId[];

/** Items a Poké Mart sells unless the clerk has a list: balls, healing and cures */
export const sold = itemIds.filter((id) => ["ball", "heal", "cure"].includes(items[id].kind));

/** Items a Poké Mart can be set to sell (key items like rods are only handed out) */
export const sellable = itemIds.filter((id) => items[id].price > 0);

/** Items a Pokémon can hold */
export const holdable = itemIds.filter((id) => items[id].kind === "hold");

/** Best rod in a bag (null without one) */
export function bestRod(count: (id: ItemId) => number) {
  return (["super-rod", "good-rod", "old-rod"] as const).find((id) => count(id) > 0) ?? null;
}

/** Is a string an item id */
export function isItem(id: string): id is ItemId {
  return id in items;
}

/** "3 Potions", "a Great Ball" */
export function itemCount(id: ItemId, count: number) {
  const { name } = items[id];
  return count === 1 ? `${/^[AEIOU]/i.test(name) ? "an" : "a"} ${name}` : `${count} ${name}s`;
}
