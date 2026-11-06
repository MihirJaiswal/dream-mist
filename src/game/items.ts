/**
 * Items in the bag: Poké Balls, healing, cures, evolution stones, held items and key items.
 * Sold by Poké Mart clerks (items that cost nothing aren't sold), handed out by people and story rewards.
 * `amount` is HP for healing (a share of max HP for revives), and steps for repels
 */
export const items = {
  "poke-ball": { name: "Poké Ball", price: 200, kind: "ball", rate: 1, about: "Catches wild Pokémon" },
  "great-ball": { name: "Great Ball", price: 600, kind: "ball", rate: 1.5, about: "Catches better than a Poké Ball" },
  "ultra-ball": { name: "Ultra Ball", price: 1200, kind: "ball", rate: 2, about: "Catches better than a Great Ball" },
  "master-ball": { name: "Master Ball", price: 0, kind: "ball", rate: 255, about: "Catches any wild Pokémon without fail" },
  potion: { name: "Potion", price: 300, kind: "heal", amount: 20, about: "Restores 20 HP" },
  "super-potion": { name: "Super Potion", price: 700, kind: "heal", amount: 50, about: "Restores 50 HP" },
  "hyper-potion": { name: "Hyper Potion", price: 1200, kind: "heal", amount: 200, about: "Restores 200 HP" },
  "max-potion": { name: "Max Potion", price: 2500, kind: "heal", amount: 9999, about: "Restores all HP" },
  "full-restore": { name: "Full Restore", price: 3000, kind: "heal", amount: 9999, cures: "all", about: "Restores all HP and cures any condition" },
  revive: { name: "Revive", price: 1500, kind: "revive", amount: 0.5, about: "Revives a fainted Pokémon with half its HP" },
  "max-revive": { name: "Max Revive", price: 0, kind: "revive", amount: 1, about: "Revives a fainted Pokémon with all its HP" },
  antidote: { name: "Antidote", price: 100, kind: "cure", cures: "poison", about: "Cures poison" },
  "paralyze-heal": { name: "Paralyze Heal", price: 200, kind: "cure", cures: "paralysis", about: "Cures paralysis" },
  awakening: { name: "Awakening", price: 250, kind: "cure", cures: "sleep", about: "Wakes up a sleeping Pokémon" },
  "burn-heal": { name: "Burn Heal", price: 250, kind: "cure", cures: "burn", about: "Heals a burn" },
  "full-heal": { name: "Full Heal", price: 600, kind: "cure", cures: "all", about: "Wakes up and cures poison, paralysis and burns" },
  "rare-candy": { name: "Rare Candy", price: 0, kind: "candy", about: "Raises a Pokémon's level by one" },
  repel: { name: "Repel", price: 350, kind: "repel", amount: 100, about: "Weaker wild Pokémon stay away for 100 steps" },
  "super-repel": { name: "Super Repel", price: 500, kind: "repel", amount: 200, about: "Weaker wild Pokémon stay away for 200 steps" },
  "max-repel": { name: "Max Repel", price: 700, kind: "repel", amount: 250, about: "Weaker wild Pokémon stay away for 250 steps" },
  "escape-rope": { name: "Escape Rope", price: 550, kind: "rope", about: "Leads you out of a cave or building, back outside" },
  "fire-stone": { name: "Fire Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Vulpix and Eevee" },
  "water-stone": { name: "Water Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Poliwhirl and Eevee" },
  "thunder-stone": { name: "Thunder Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Pikachu and Eevee" },
  "leaf-stone": { name: "Leaf Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Gloom and Nuzleaf" },
  "moon-stone": { name: "Moon Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Clefairy and Skitty" },
  "sun-stone": { name: "Sun Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Gloom and Sunkern" },
  "shiny-stone": { name: "Shiny Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Togetic and Roselia" },
  "dusk-stone": { name: "Dusk Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Murkrow and Misdreavus" },
  "dawn-stone": { name: "Dawn Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve: male Kirlia and female Snorunt" },
  "ice-stone": { name: "Ice Stone", price: 2100, kind: "evolve", about: "Makes certain Pokémon evolve, like Eevee and Crabrawler" },
  "linking-cord": { name: "Linking Cord", price: 3000, kind: "evolve", trade: true, about: "Makes Pokémon that evolve by trading evolve without one" },
  "black-augurite": { name: "Black Augurite", price: 0, kind: "evolve", about: "Makes Scyther evolve into Kleavor" },
  "peat-block": { name: "Peat Block", price: 0, kind: "evolve", about: "Makes Ursaring evolve into Ursaluna" },
  "tart-apple": { name: "Tart Apple", price: 0, kind: "evolve", about: "Makes Applin evolve into Flapple" },
  "sweet-apple": { name: "Sweet Apple", price: 0, kind: "evolve", about: "Makes Applin evolve into Appletun" },
  "syrupy-apple": { name: "Syrupy Apple", price: 0, kind: "evolve", about: "Makes Applin evolve into Dipplin" },
  "cracked-pot": { name: "Cracked Pot", price: 0, kind: "evolve", about: "Makes Sinistea evolve into Polteageist" },
  "unremarkable-teacup": { name: "Unremarkable Teacup", price: 0, kind: "evolve", about: "Makes Poltchageist evolve into Sinistcha" },
  "scroll-of-darkness": { name: "Scroll of Darkness", price: 0, kind: "evolve", about: "Makes Kubfu evolve into Urshifu" },
  "auspicious-armor": { name: "Auspicious Armor", price: 0, kind: "evolve", about: "Makes Charcadet evolve into Armarouge" },
  "malicious-armor": { name: "Malicious Armor", price: 0, kind: "evolve", about: "Makes Charcadet evolve into Ceruledge" },
  "metal-alloy": { name: "Metal Alloy", price: 0, kind: "evolve", about: "Makes Duraludon evolve into Archaludon" },
  "old-rod": { name: "Old Rod", price: 0, kind: "rod", tier: 0, about: "Fish while facing water" },
  "good-rod": { name: "Good Rod", price: 0, kind: "rod", tier: 1, about: "Fish while facing water. Hooks more Pokémon than the Old Rod" },
  "super-rod": { name: "Super Rod", price: 0, kind: "rod", tier: 2, about: "Fish while facing water. Hooks every Pokémon that lives there" },
  "hm-flash": { name: "HM05 Flash", price: 0, kind: "hm", about: "Lights up dark caves" },
  "hm-cut": { name: "HM01 Cut", price: 0, kind: "hm", about: "Cuts down small trees in the way" },
  "hm-strength": { name: "HM04 Strength", price: 0, kind: "hm", about: "Pushes big boulders around" },
  "hm-rock-smash": { name: "HM06 Rock Smash", price: 0, kind: "hm", about: "Smashes cracked rocks" },
  "vs-seeker": { name: "VS Seeker", price: 0, kind: "hm", about: "Press V: trainers you beat nearby want a rematch. Recharges as you walk" },
  "exp-share": { name: "Exp. Share", price: 0, kind: "key", about: "Turn it on: Pokémon that didn't battle get half the EXP. Points too" },
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
  "soothe-bell": { name: "Soothe Bell", price: 3000, kind: "hold", about: "Held: the Pokémon grows friendly faster" },
  everstone: { name: "Everstone", price: 3000, kind: "hold", about: "Held: the Pokémon doesn't evolve" },
  "metal-coat": {
    name: "Metal Coat",
    price: 2000,
    kind: "hold",
    boosts: "steel",
    about: "Held: Steel moves get 20% stronger. Onix and Scyther evolve holding it when traded",
  },
  "dragon-scale": {
    name: "Dragon Scale",
    price: 2000,
    kind: "hold",
    boosts: "dragon",
    about: "Held: Dragon moves get 20% stronger. Seadra evolves holding it when traded",
  },
  "kings-rock": { name: "King's Rock", price: 2000, kind: "hold", about: "Held: Poliwhirl and Slowpoke evolve holding it when traded" },
  "up-grade": { name: "Up-Grade", price: 2000, kind: "hold", about: "Held: Porygon evolves holding it when traded" },
  "deep-sea-tooth": { name: "Deep Sea Tooth", price: 2000, kind: "hold", about: "Held: Clamperl evolves into Huntail holding it when traded" },
  "deep-sea-scale": { name: "Deep Sea Scale", price: 2000, kind: "hold", about: "Held: Clamperl evolves into Gorebyss holding it when traded" },
  "prism-scale": { name: "Prism Scale", price: 2000, kind: "hold", about: "Held: Feebas evolves holding it when traded" },
  electirizer: { name: "Electirizer", price: 2000, kind: "hold", about: "Held: Electabuzz evolves holding it when traded" },
  magmarizer: { name: "Magmarizer", price: 2000, kind: "hold", about: "Held: Magmar evolves holding it when traded" },
  protector: { name: "Protector", price: 2000, kind: "hold", about: "Held: Rhydon evolves holding it when traded" },
  "reaper-cloth": { name: "Reaper Cloth", price: 2000, kind: "hold", about: "Held: Dusclops evolves holding it when traded" },
  "dubious-disc": { name: "Dubious Disc", price: 2000, kind: "hold", about: "Held: Porygon2 evolves holding it when traded" },
  sachet: { name: "Sachet", price: 2000, kind: "hold", about: "Held: Spritzee evolves holding it when traded" },
  "whipped-dream": { name: "Whipped Dream", price: 2000, kind: "hold", about: "Held: Swirlix evolves holding it when traded" },
  "razor-claw": { name: "Razor Claw", price: 2000, kind: "hold", about: "Held: Sneasel evolves leveling up at night" },
  "razor-fang": { name: "Razor Fang", price: 2000, kind: "hold", about: "Held: Gligar evolves leveling up at night" },
  "oval-stone": { name: "Oval Stone", price: 2000, kind: "hold", about: "Held: Happiny evolves leveling up during the day" },
} as const satisfies Record<
  string,
  {
    name: string;
    price: number;
    kind: "ball" | "heal" | "cure" | "revive" | "candy" | "repel" | "rope" | "evolve" | "rod" | "hm" | "key" | "hold";
    heal?: number;
    /** Conditions it cures ("all" of them) */
    cures?: "all" | "sleep" | "poison" | "paralysis" | "burn";
    /** Linking Cord: does what a trade would */
    trade?: true;
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

/** Items a Poké Mart sells unless the clerk has a list, like an early Emerald Mart (stronger items are for clerks given a list) */
export const sold: ItemId[] = [
  "poke-ball",
  "great-ball",
  "potion",
  "super-potion",
  "antidote",
  "paralyze-heal",
  "awakening",
  "burn-heal",
  "full-heal",
  "repel",
  "escape-rope",
];

/** Items a Poké Mart can be set to sell (key items like rods are only handed out) */
export const sellable = itemIds.filter((id) => items[id].price > 0);

/** Items a Pokémon can hold */
export const holdable = itemIds.filter((id) => items[id].kind === "hold");

/** Bag pockets, in the order of Emerald's bag (`frame` is the bag picture of each pocket) */
export const pockets = [
  { id: "items", name: "ITEMS", frame: 1 },
  { id: "balls", name: "POKé BALLS", frame: 3 },
  { id: "tms", name: "TMs & HMs", frame: 4 },
  { id: "berries", name: "BERRIES", frame: 5 },
  { id: "key", name: "KEY ITEMS", frame: 2 },
] as const;

/** Bag pocket */
export type Pocket = (typeof pockets)[number]["id"];

/** Pocket an item goes in: Poké Balls, HMs, berries, key items (rods, VS Seeker, Exp. Share), or items (healing, stones, held items) */
export function pocketOf(id: ItemId): Pocket {
  const { kind } = items[id];
  return kind === "ball" ? "balls" : id.startsWith("hm-") ? "tms" : id.endsWith("-berry") ? "berries" : ["rod", "hm", "key"].includes(kind) ? "key" : "items";
}

/** Emerald icon of an item (HMs are colored by their move's type) */
export function iconOf(id: ItemId) {
  const own: Partial<Record<ItemId, string>> = { "hm-flash": "hm_normal", "hm-cut": "hm_normal", "hm-strength": "hm_normal", "hm-rock-smash": "hm_fighting" };
  return `/game/items/${own[id] ?? id.replace(/-/g, "_")}.png`;
}

/** Best rod in a bag (null without one) */
export function bestRod(count: (id: ItemId) => number) {
  return (["super-rod", "good-rod", "old-rod"] as const).find((id) => count(id) > 0) ?? null;
}

/** Is a string an item id */
export function isItem(id: string): id is ItemId {
  return id in items;
}

/** "Potions", "Oran Berries" */
export function plural(name: string) {
  return /[^aeiou]y$/i.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`;
}

/** "3 Potions", "a Great Ball", "2 Oran Berries" */
export function itemCount(id: ItemId, count: number) {
  const { name } = items[id];
  return count === 1 ? `${/^[AEIOU]/i.test(name) ? "an" : "a"} ${name}` : `${count} ${plural(name)}`;
}
