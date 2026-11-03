# DreamMist game guide for AI agents

> **Give this whole file to your agent**, then ask it for the game you want, for example: *"Make me a DreamMist game: a foggy fishing village, a route through a forest with bug trainers, a gym of Water types and a side quest about a lost Wingull."* The agent writes one `.city.json` file. Open DreamMist, go to **Your cities → Import file**, pick the file, and play.

This guide is written for agents (Claude, ChatGPT, Cursor, any coding agent). It explains everything a DreamMist game file contains, gives a ready-made builder script so you never have to type thousands of numbers by hand, and ends with design rules for making the game look and play beautifully.

---

## 0. How you, the agent, should work

1. **Read this whole guide** before writing anything.
2. **Plan the game** in words first: the maps, where they sit, the story steps, who completes each step, the wild Pokémon and trainers, and a level curve. Show the plan to the user if you can.
3. **Copy the builder script** from section 10 into a file named `build-town.mjs`. Keep part 1 (the kit) exactly as it is. Replace part 2 with your game.
4. **Run it**: `node build-town.mjs > my-game.city.json` (Node 18 or newer, no packages needed). It stops with a list of mistakes if something is wrong.
5. **Give the user the JSON file** and tell them to import it from **Your cities → Import file**. In the editor, the **Problems** count in the bottom bar lists anything that still won't work. Ask them for it if you can't run DreamMist yourself.

If you can't run code, you can still write the JSON by hand for a small map, but follow section 2 exactly: every grid must have exactly `width × height` numbers.

---

## 1. What a DreamMist game is

A game is a **city**: one JSON object. It has:

- an **outside map**: the town the player arrives in;
- **interiors**: houses, a Pokémon Center, a Poké Mart, a gym, a lab, caves… reached through **doors**;
- **outdoor maps**: routes and other towns, placed next to the outside map on a big grid (the **region**). The player walks from one to the next across their touching edges, with no door;
- **people** on every map: villagers, trainers, a Nurse, Poké Mart clerks, Pokémon standing around, signs;
- **wild Pokémon** in **encounter zones** (usually tall grass);
- a **story**: a main chain of steps and optional **side quests**. Talking to (or beating) someone completes a step. Steps open blocked roads, make people appear or leave, and give rewards;
- per map **weather** (rain, snow, fog, sandstorm) and **time of day** (evening, night).

What the player gets for free (you don't build it):

- They create a trainer when they first press Play and pick **Treecko (252), Torchic (255) or Mudkip (258) at level 5**.
- They start with **10 Poké Balls, 5 Potions and ₽3,000**.
- Battles use the real Generation 3 rules: all 1,025 Pokémon with real types, stats and level-up moves, stat changes, sleep, poison, paralysis and burns, evolution at the right level, catching, experience.
- Winning a trainer battle pays **₽40 × the level of their strongest Pokémon**. Blacking out sends them back to the map's spawn, healed, minus half their money.
- A **Journal** (key J) shows the next story goal and the side quests in progress.

---

## 2. The file format

A city file is one JSON object. Every map (the outside map, each interior, each outdoor map) has the same shape.

### 2.1 The grid

- Coordinates are tiles. `x` goes right, `y` goes down. `(0, 0)` is the top-left tile.
- Every grid is a flat array of `width × height` numbers. The tile at `(x, y)` is at index `y * width + x`.
- **A grid with the wrong length is silently replaced by zeros on import.** Always check lengths (the kit does).
- Maps can be 6 to 128 tiles wide and tall. Good sizes: towns 30×24 to 48×36, routes 20×40 (vertical) or 40×20 (horizontal), interiors 12×9 to 18×14.

### 2.2 The city object

```ts
type City = {
  v: 1;
  id: string;                 // anything; replaced on import
  name: string;               // up to 40 characters, shown everywhere
  author: string;             // up to 40 characters
  width: number;              // outside map size in tiles
  height: number;
  layers: {                   // three tile layers, drawn bottom to top
    ground: number[];         // floor: grass, paths, water, floors
    decor: number[];          // objects: buildings, tree trunks, tall grass, flowers, signs
    above: number[];          // drawn over the player: tree tops, roofs the player walks behind
  };
  solid: number[];            // 1 = can't walk there, 0 = walkable (separate from the tiles!)
  behavior: number[];         // tile behaviors: ledges, surf water, ice, push tiles (2.4); 0 = normal
  zone: number[];             // 0 = no wild Pokémon, n = zones[n - 1]
  gate: number[];             // 0 = open, n = blocked until the story step whose `n` is n is done
  npcs: Npc[];                // people, Pokémon, signs and items on this map
  doors: Door[];
  triggers: Trigger[];        // event areas that play a cutscene when stepped in (6.1)
  spawn: { x: number; y: number };  // where visitors arrive (outside map only)
  weather?: "rain" | "snow" | "fog" | "sandstorm";  // leave out for clear. Rain, sandstorm and snow also change battles
  time?: "morning" | "evening" | "night" | "clock"; // leave out for day; "clock" follows the player's real time
  type?: "outdoor" | "indoor" | "cave";             // kind of place (picks the battle scene); leave out for outdoor
  dark?: true;                                      // dark until the player has HM05 Flash
  song?: string;                                    // an uploaded music url for this map; leave out for the town music
  rules?: { difficulty?: "easy" | "hard"; caps?: number[] };  // trainer difficulty (normal by default), level caps by badges earned here
  battle?: { image: string; platforms: boolean };   // optional battle background picture (url), default for every map
  zones: Zone[];              // shared by every map
  story: Step[];              // shared by every map
  quests: Quest[];            // shared by every map
  interiors: Map[];           // interiors AND outdoor maps, up to 40 in total
  updated: number;            // a timestamp in milliseconds
};

// Interiors and outdoor maps: the same fields as the city, without
// author, zones, story, quests, interiors (they share the city's)
type Map = {
  id: string;                 // unique; doors point to it
  name: string;               // up to 40 characters
  width: number; height: number;
  layers: { ground: number[]; decor: number[]; above: number[] };
  solid: number[]; behavior: number[]; zone: number[]; gate: number[];
  npcs: Npc[]; doors: Door[]; triggers: Trigger[];
  spawn: { x: number; y: number };
  weather?: "rain" | "snow" | "fog" | "sandstorm";
  time?: "morning" | "evening" | "night" | "clock";
  type?: "outdoor" | "indoor" | "cave";   // leave out: outdoor for outdoor maps, indoor for interiors. Caves: "cave"
  dark?: true;
  song?: string;
  battle?: { image: string; platforms: boolean };   // optional battle background for this map only
  outdoor?: true;                       // a route or town joined by its edges, not by doors
  region?: { x: number; y: number };    // outdoor maps: top-left corner on the region grid
};
```

### 2.3 Tiles and collision are separate

Tile numbers only decide what is **drawn**. Whether the player can walk somewhere is decided only by the `solid` grid. When you place a building, a tree trunk, water, a fence or a rock, **also set `solid` to 1 on those tiles**. Tall grass, flowers and paths stay walkable (`solid` 0). A **door tile must be walkable** even though it's part of a building.

Tile values are *tileset frame + 1*, and `0` means empty. Use the values below; they're already +1.

### 2.4 Tile behaviors

The `behavior` grid gives tiles a special effect, on top of `solid`:

| Value | Tile | Notes |
| --- | --- | --- |
| `1` `2` `3` `4` | Ledge jumped down, up, left, right | Walking onto it in its direction jumps over it to the tile beyond (which must be free). Blocked from every other side. Put them along a route so players hop down a shortcut and take the long way back |
| `5` | Surf water | Crossed by surfing once a party Pokémon is Water type; `solid` is ignored on it. Paint it on water tiles (which stay `solid` 1) and keep the shore walkable |
| `6` | Ice | The player slides until something stops them or they leave the ice. Needs `solid` 0 |
| `7` `8` `9` `10` | Push tile up, down, left, right | Moves the player along until a normal tile. Needs `solid` 0 |

People and Pokémon on the map never walk onto ledges or surf water. Without a Water type in the party, surf water is just a wall, so don't put the main path behind it.

---

## 3. Tile catalog

### 3.1 Single tiles

| Name | Value | Layer | Solid | Notes |
| --- | --- | --- | --- | --- |
| Grass | 114 | ground | no | The default ground everywhere outside |
| Tall grass | 207 | decor | no | Draw it on decor over grass, and paint an encounter `zone` under it |
| Sand path | 4978 | ground | no | Main roads in towns and routes |
| Gravel path | 2608 | ground | no | Mountain and cave paths |
| Pavement | 4975 | ground | no | City streets |
| Water | 2375 | ground | **yes** | There's no surfing: water is a wall. Ponds, rivers, the sea |
| Flowers | 659 | decor | no | Scatter in small groups of 2 to 4 |
| Sign post | 206 | decor | yes | Put a sign person on the same tile (section 5.4) |
| Small tree | 95 | decor | yes | A one-tile tree, good for blocking a path until a story step |
| Dry bush | 208 | decor | yes | |
| Boulder | 546 | decor | yes | |
| Rocks | 547 | decor | yes | |
| Fence | 1901 | decor | yes | Line them up for pens and gardens |
| Posts | 1907 | decor | yes | |

### 3.2 Stamps (multi-tile objects)

Rows are listed top to bottom. **All of these are on the decor layer and solid**, except rows marked *above* (drawn over the player and walkable behind).

| Stamp | Size (w×h) | Door tile (column, row from its top-left) | Tiles |
| --- | --- | --- | --- |
| Tree | 2×2 | none | above: `[212, 213]`, decor: `[325, 326]` |
| Pine tree | 2×2 | none | above: `[216, 217]`, decor: `[329, 330]` |
| House | 5×5 | (3, 4) | `[2735,2736,2736,2736,2741] [2848,2849,2849,2849,2854] [2961,2962,2962,2962,2967] [3074,3077,3078,3075,3080] [3187,3190,3191,3188,3193]` |
| Small house | 4×4 | (1, 3) | `[3650,3651,3651,3653] [3763,3764,3764,3766] [3876,3877,3878,3879] [3989,3990,3991,3992]` |
| Lab | 7×5 | (4, 4) | `[475,477,478,476,476,476,479] [588,590,591,589,589,589,592] [588,589,589,589,589,589,592] [701,703,703,707,702,706,705] [814,816,816,820,815,819,818]` |
| Pokémon Center | 4×4 | (1, 3) | `[23,24,25,26] [136,137,138,139] [249,250,251,252] [362,363,364,365]` |
| Poké Mart | 4×4 | (1, 3) | `[27,28,28,30] [140,141,142,143] [253,254,255,256] [362,363,368,369]` |

Use the House stamp for gyms too, with a sign in front saying it's the gym.

**Trees are 2 tiles wide: place them on even columns** (x = 0, 2, 4…) so borders line up. Their top row is on the *above* layer and **not solid**, which means the player can walk behind tree tops. That's why a border needs whole trees, and why a map edge only counts as crossable where no *above* tile is in the way (section 7.3).

### 3.3 Terrains (patches with rounded borders)

Each terrain is a 3×3 block: `[top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right]`. Draw the corners and edges around a rectangle and fill the middle with the center tile. Over grass, put patches on the **decor** layer (walkable). For interior floors, fill the **ground** with the center tile.

| Terrain | Tiles | Use |
| --- | --- | --- |
| Light grass | `[2488,2489,2490,2601,2602,2603,2714,2715,2716]` | Meadows, park lawns, around ponds |
| Sand | `[2491,2492,2493,2604,2605,2606,2717,2718,2719]` | Beaches, plazas |
| Dirt | `[2494,2495,2496,2607,2608,2609,2720,2721,2722]` | Farms, worn ground, cave floors |
| Stone floor | `[2500,2501,2502,2613,2614,2615,2726,2727,2728]` | Pokémon Center, Mart, lab floors (center: 2614) |
| Tiled floor | `[2503,2504,2505,2616,2617,2618,2729,2730,2731]` | House floors (center: 2617) |
| Brick floor | `[2506,2507,2508,2619,2620,2621,2732,2733,2734]` | Gym floors (center: 2620) |

The editor has 6,328 more tiles. You can only reach those through the editor's palette, so stick to this catalog. The user can decorate further in the editor after importing.

---

## 4. Wild Pokémon

```ts
type Zone = {
  name: string;               // shown in the editor, e.g. "Route 101 grass"
  rate: number;               // chance of an encounter per step, 0 to 1. Tall grass: 0.1 to 0.15
  color: number;              // editor overlay color, e.g. 0x2ecc40
  creatures: {
    species: number; min: number; max: number;  // national Pokédex number, level range
    method?: "surf" | "fish";                   // leave out for walking (grass, caves)
    time?: "morning" | "day" | "night";         // leave out for any time
    rod?: "good" | "super";                     // fishing only: the weakest rod that hooks it (leave out: any rod)
  }[];
};
```

- Paint the zone's number (1 for the first zone) on the `zone` grid wherever encounters can happen, and draw tall grass on those tiles so players see where they are. **Walking encounters happen on every tile with a zone, grass or not.**
- Each step on a zone tile has `rate` chance of a battle, and each listed Pokémon for that way of moving and part of the day is equally likely. List a common Pokémon twice to make it more frequent.
- **Water**: paint the same zone on a pond or the sea, with `method: "surf"` Pokémon (met while surfing on tiles with behavior 5, see 2.4) and `method: "fish"` ones (hooked by facing the water with a rod). Give out the rods (`old-rod`, `good-rod`, `super-rod`) as gifts or item balls: they're never sold.
- **Time**: `time` uses the map's `time` (`evening` counts as day; `clock` follows the player's clock: mornings 4 to 10, nights 20 to 4). Hoothoot 163 at night and Ledyba 165 in the morning make a route feel alive.
- Early areas: levels 2 to 5. Then raise levels by about 3 per route.

Good Hoenn Pokémon by place (national Pokédex numbers):

| Place | Pokémon |
| --- | --- |
| First routes | Zigzagoon 263, Wurmple 265, Poochyena 261, Taillow 276, Seedot 273, Lotad 270 |
| Forest | Shroomish 285, Slakoth 287, Wurmple 265, Nincada 290, Oddish 43 |
| Coast and water edges | Wingull 278, Marill 183, Azurill 298, Lotad 270, Tentacool 72, Magikarp 129, Goldeen 118 |
| Caves | Zubat 41, Geodude 74, Makuhita 296, Whismur 293, Aron 304, Nosepass 299 |
| Fields and meadows | Ralts 280 (rare), Skitty 300, Electrike 309, Plusle 311, Minun 312, Abra 63 |
| Mountains and late areas | Swablu 333, Zangoose 335, Seviper 336, Absol 359, Spheal 363, Bagon 371, Beldum 374 |

Any number from 1 to 1025 works, not only Hoenn.

---

## 5. People, Pokémon and signs

```ts
type Npc = {
  x: number; y: number;              // a walkable tile (not solid)
  sprite: string;                    // look (5.1); "" for signs and Pokémon
  creature?: { species: number; level: number };  // set it to make a Pokémon instead of a person
  dir: "up" | "down" | "left" | "right";          // facing; trainers see in this direction
  name: string;                      // shown with their dialogue (up to 24 characters)
  dialogue: string;                  // what they say. An empty line ("\n\n") starts a new page
  role: "talk" | "trainer" | "healer" | "shop" | "wild" | "item";
  wander: boolean;                   // walk around near their spot
  path?: { points: { x: number; y: number }[]; loop: boolean; run: boolean; pause: number };  // a patrol instead
  approach?: boolean;                // walks up and talks the first time they see the player (a cutscene)
  gift?: { item: ItemId; count: number };          // handed over the first time they talk, once per player (role "item": what the item holds)
  hidden?: boolean;                  // role "item": hidden on the ground instead of a ball
  script?: { actions: Action[]; once: boolean };   // a cutscene played instead of their usual part (6.1)
  shop?: ItemId[];                   // role "shop": what they sell (everything when left out)
  trainer?: { team: { species: number; level: number; held?: ItemId }[]; gym: boolean; badge: string; defeat: string };
  portrait?: string;                 // "sprite:<name>" to show another sprite beside their dialogue
  hidePortrait?: boolean;
  story?: NpcStory;                  // section 6
};
```

### 5.1 Sprites (looks)

`may`, `wally`, `mom`, `norman`, `roxanne`, `brawly`, `scientist`, `shopkeeper_f` (Nurse), `shopkeeper_m` (clerk), `youngster`, `lass`, `bug_catcher`, `hiker`, `fisher`, `sailor`, `swimmer_m`, `swimmer_f`, `tuber_m`, `tuber_f`, `twin`, `rich_boy`, `rich_boy_2`, `gentleman`, `aroma`, `black_belt`, `expert_f`, `ace_trainer`, `ranger`, `ranger_m`, `psychic`, `guitarist`, `pokefan`, `pokemaniac`, `schoolkid_m`, `schoolkid_f`, `triathlete_m`, `triathlete_f`, `elder_m`, `elder_f`, `seko`, `generic_m1` to `generic_m5`, `generic_f1` to `generic_f5`, `generic_c1` to `generic_c3` (children).

Pick looks that fit the role: `hiker` in caves, `fisher` and `sailor` by the water, `bug_catcher` in forests, `shopkeeper_f` for every Nurse.

### 5.2 Roles

| Role | What happens when the player talks to them |
| --- | --- |
| `talk` | Says their dialogue. A Pokémon (`creature` set) says it as its cry, like `"Pika!"` |
| `trainer` | Says their dialogue, then battles with `trainer.team`. Beaten trainers say `trainer.defeat` and never battle again. Trainers who see the player **within 4 tiles in front of them** walk up and challenge them. `gym: true` plus a `badge` name makes a Gym Leader: the winner earns the badge and 5 Poké Balls |
| `healer` | Says their dialogue and heals the whole party. In a city with no shop, Nurses also refill Poké Balls and Potions to 5 each |
| `shop` | Says their dialogue, then opens the Poké Mart with the `shop` items |
| `wild` | A Pokémon standing on the map (`creature` set) that battles as a wild Pokémon: beat it or catch it, then it's gone for that player. Great for legendaries and rare encounters |
| `item` | An item on the ground (`sprite: ""`, `gift` set): a Poké Ball the player picks up, or with `hidden: true` nothing shows and the player finds it by facing the tile and pressing Space. Once per player. An item ball blocks its tile until picked up |

### 5.3 Items

| `ItemId` | Name | Price | Does |
| --- | --- | --- | --- |
| `poke-ball` | Poké Ball | ₽200 | Catches |
| `great-ball` | Great Ball | ₽600 | Catches 1.5× better |
| `potion` | Potion | ₽300 | +20 HP |
| `super-potion` | Super Potion | ₽700 | +50 HP |
| `full-heal` | Full Heal | ₽600 | Cures sleep, poison, paralysis, burn |
| `old-rod`, `good-rod`, `super-rod` | Fishing rods | key item | Fish facing water (section 4). Never sold: hand them out |
| `hm-flash` | HM05 Flash | key item | Lights up `dark` maps. Hand it out before the first dark cave |
| `oran-berry`, `sitrus-berry`, `lum-berry` | Berries | ₽100 to 500 | Held: heal at half HP, or cure a condition, once |
| `leftovers`, `quick-claw` | Held items | ₽2000 to 4000 | Held: heal a little each turn; sometimes move first |
| `charcoal`, `mystic-water`, `miracle-seed`, `magnet`, `silk-scarf` | Type boosters | ₽1000 | Held: Fire, Water, Grass, Electric, Normal moves ×1.2 |

Poké Mart clerks without a `shop` list sell only the first five. Add held items to a clerk's `shop` to sell them. Trainers' team members can hold one (`held`).

### 5.3b Battles

- Every Pokémon gets a random nature and one of its species' abilities. Abilities like Intimidate, Levitate, Static, Overgrow and Swift Swim work in battle.
- `rules.difficulty`: `"easy"` trainers pick moves at random, `"hard"` ones always pick the best move. Use hard for gyms in a challenge game.
- `rules.caps`: highest level for 0, 1, 2… badges earned in this town, like `[14, 20, 26, 32]`. Keeps the player from outleveling the gyms.
- Battle backgrounds are automatic Emerald scenes (grass outdoors, building indoors, cave for `type: "cave"`, sea when surfing). Set a map's `battle` to `{ image: "/game/battle/sand.png", platforms: false }` for another scene: `tall_grass`, `long_grass`, `sand`, `rock`, `cave`, `water`, `pond_water`, `underwater`, `sky`, `building`, `stadium`.
- People can also use every Emerald overworld sprite, with the `em_` prefix (on top of the looks in 5.1): `em_anabel`, `em_aqua_member_f`, `em_aqua_member_m`, `em_archie`, `em_artist`, `em_beauty`, `em_black_belt`, `em_boy_1`, `em_boy_2`, `em_boy_3`, `em_brandon`, `em_brawly`, `em_brendan`, `em_bug_catcher`, `em_cameraman`, `em_camper`, `em_contest_judge`, `em_cook`, `em_devon_employee`, `em_drake`, `em_expert_f`, `em_expert_m`, `em_fat_man`, `em_fisherman`, `em_flannery`, `em_gameboy_kid`, `em_gentleman`, `em_girl_1`, `em_girl_2`, `em_girl_3`, `em_glacia`, `em_greta`, `em_hex_maniac`, `em_hiker`, `em_hot_springs_old_woman`, `em_juan`, `em_lass`, `em_leaf`, `em_link_receptionist`, `em_little_boy`, `em_little_girl`, `em_liza`, `em_lucy`, `em_magma_member_f`, `em_magma_member_m`, `em_man_1`, `em_man_2`, `em_man_3`, `em_man_4`, `em_man_5`, `em_maniac`, `em_mart_employee`, `em_mauville_old_man_1`, `em_mauville_old_man_2`, `em_maxie`, `em_may`, `em_mom`, `em_mystery_event_deliveryman`, `em_ninja_boy`, `em_noland`, `em_norman`, `em_old_man`, `em_old_woman`, `em_phoebe`, `em_picnicker`, `em_pokefan_f`, `em_pokefan_m`, `em_prof_birch`, `em_psychic_m`, `em_red`, `em_reporter_f`, `em_reporter_m`, `em_rich_boy`, `em_rooftop_sale_woman`, `em_roxanne`, `em_rs_little_boy`, `em_running_triathlete_f`, `em_running_triathlete_m`, `em_sailor`, `em_school_kid_m`, `em_scientist_1`, `em_scientist_2`, `em_scott`, `em_sidney`, `em_spenser`, `em_steven`, `em_swimmer_f`, `em_swimmer_m`, `em_tate`, `em_teala`, `em_tuber_f`, `em_tuber_m`, `em_tuber_m_swimming`, `em_tucker`, `em_twin`, `em_union_room_attendant`, `em_wallace`, `em_wally`, `em_wattson`, `em_winona`, `em_woman_1`, `em_woman_2`, `em_woman_3`, `em_woman_4`, `em_woman_5`, `em_youngster`.

### 5.4 Signs

A sign is a person with `sprite: ""`, no `creature`, and the sign text as `dialogue`. Put the **sign post tile (206) on decor** at the same spot and make it solid, so players see something to read. Every town and route should have one at its entrance.

### 5.5 Item balls

Scatter 2 to 4 items per route: an item ball at the end of a dead end, a hidden item behind a tree or where a sign hints. They reward exploring. Put them on walkable tiles.

### 5.6 Writing dialogue

- Short pages: one or two sentences each, separated by an empty line (`"\n\n"`).
- Give everyone a reason to exist: a tip, a joke, local lore, a hint about the next step.
- Trainers get a one-line challenge in `dialogue` and a one-line `defeat`.

---

## 6. The story

The story is what turns a map into a game.

```ts
type Step = {
  id: string;                 // unique; people refer to it
  n: number;                  // unique positive number; gate tiles use it
  name: string;               // "Meet the Professor"
  goal?: string;              // what the Journal says while it's the next step: "Visit Professor Birch in his lab"
  quest?: string;             // a side quest's id; leave out for the main story
  blocked: string;            // message when the player bumps into this step's gate tiles
  blocker?: "wall" | "object" | "person";  // what stands on the gates (default "wall": invisible)
  tile?: number;              // blocker "object": the tile drawn on each gate, e.g. 95 (small tree), 546 (boulder)
};

type Quest = { id: string; name: string; after?: string };  // after: a step id; the quest's steps can't happen before it

type NpcStory = {
  after?: string;             // appears only once this step is done
  until?: string;             // disappears once this step is done (guards, people in the way)
  requires?: string;          // won't help (or battle) until this step is done…
  locked?: string;            // …and says this meanwhile
  completes?: string;         // talking to them (or beating them, for trainers and wild Pokémon) completes this step
  done?: string;              // what they say every time afterwards
  reward?: { species?: number; level?: number; balls?: number; potions?: number; money?: number };  // given once, when completing
};
```

How it plays:

1. Talking to someone: if they `require` a step that isn't done, they say `locked` and nothing happens.
2. If their step is already done and they have `done`, they say it.
3. Otherwise they say their dialogue (and battle, heal or open the shop).
4. If they `complete` a step that isn't done, and its side quest has started, it's done: the reward is given, a banner shows what's next, gates open, people appear or leave.

- The **main story** is the steps without `quest`, in array order. Steps don't force an order by themselves: use `requires` and `after` on people to make them happen in order.
- **Gates**: set the `gate` grid to a step's `n` on the tiles that block the way, for example the exit of the town. Cover the **whole** opening, or players walk around it. `blocker: "object"` with `tile: 95` draws a small tree on the gates that disappears when the step is done.
- **Person blockers**: someone with `story.until` standing in a narrow path blocks it until the step is done, then leaves.
- **Side quests** stay hidden until their first step is done. Make step 1 the moment someone asks for help (talking to them completes it).
- Rewards of `species` add a Pokémon to the party (a great way to give a second partner).
- Every step needs someone who completes it, or it can never happen.

### 6.1 Events and scripts (cutscenes)

A script is a list of actions played in order while the player can't move. A person plays their `script` when talked to, **instead of** their usual part (with `once: true`, only the first time). A trigger plays its `actions` when the player **steps onto** one of its tiles.

```ts
type Trigger = {
  id: string;
  x: number; y: number; w: number; h: number;  // the area, in tiles
  name: string;
  once: boolean;              // plays only the first time, per player
  after?: string;             // only once this step is done
  until?: string;             // no more once this step is done
  actions: Action[];
};

// `who` is someone's index in the same map's `npcs` array, or "player"
type Action =
  | { do: "say"; text: string; who?: number }   // no who: narration
  | { do: "come"; who: number }                 // notices the player ("!") and walks up next to them
  | { do: "move"; who: number | "player"; steps: ("up" | "down" | "left" | "right")[] }
  | { do: "face"; who: number | "player"; dir: "up" | "down" | "left" | "right" }
  | { do: "back"; who: number }                 // walks back to where they stand in `npcs`
  | { do: "wait"; seconds: number }             // 0 to 10
  | { do: "battle"; who: number }               // a trainer (or role "wild" Pokémon) of the map; stops the script if the player loses
  | { do: "give"; item: ItemId; count: number }
  | { do: "pokemon"; species: number; level: number }
  | { do: "money"; amount: number }
  | { do: "heal" }
  | { do: "step"; step: string }                // completes a story step (counts as "someone completes it")
  | { do: "warp"; to: string; x: number; y: number };  // map id ("" = outside) and tile; ends the script
```

Good uses:

- **The rival runs up**: a trigger across the path out of town with `come`, `say`, `battle`, `say`, `back`, `step`. Give the rival `story.until` that step so they leave afterwards.
- **Someone stops the player**: a one-tile trigger in front of an exit, `once: false`, `until` the step that allows leaving, with a `say` and a `move` of the player one step back.
- **A welcome**: a trigger just inside a building, `once: true`, where someone walks up and explains.

Draw triggers across the **whole** width of a path so players can't walk around them. Only people of the same map can act in it.

---

## 7. Maps: interiors, doors and the region

### 7.1 Interiors

An interior is a map in `interiors` without `outdoor`. Typical interior: 14×10, floor tiles on ground, `solid` 1 on the top two rows, the bottom row and both side columns (the walls), and one door in the middle of the bottom row that leads back out.

### 7.2 Doors

```ts
type Door = { x: number; y: number; to: string; tx: number; ty: number };
// to: "" = the outside map, or another map's id.  tx, ty: -1 = automatic arrival
```

- A door is a walkable tile (`solid` 0) that moves the player to the `to` map when stepped on.
- **Always make doors in pairs**: the building's door tile outside → the interior; the interior's exit → back to the map the building is on.
- With `tx: -1, ty: -1`, the player arrives **one tile away from the door that leads back** (below it, or above it when the door is on the bottom row). So paired doors just work.
- On the outside, the door tile is the building's door tile from the stamp table (section 3.2).

### 7.3 Outdoor maps and the region

- The outside map sits at `(0, 0)` on the region grid. An outdoor map (`outdoor: true`) has `region: { x, y }`, its top-left corner on that grid, in tiles. Maps must not overlap.
- Two maps are joined where their rectangles **touch** along an edge. Example: a 20×40 route at `region { x: 10, y: -40 }` sits right above a 40×30 town, touching columns 10 to 29 of its top edge.
- Walking off an edge moves the player onto the touching map, facing the same way. It only works where **both** edge tiles facing each other are walkable: `solid` 0 **and no tile on the `above` layer**.
- So: leave a gap in the tree border on both maps where they meet, and run the path through it. Line the gaps up: a town tile at column `c` touches the route tile at column `c - region.x`.
- Routes usually have trees along their long sides and open ends.

### 7.4 Weather and time

Battles use a built-in scene that matches the map (sky and grass outdoors, wall and floor indoors), tinted by its time and weather, so you don't need to set anything. `battle` takes a picture URL if the user gives you one; leave it out otherwise.

Set `weather` and `time` on any map. Use them for mood: a misty route at dawn (`fog`), a beach at sunset (`time: "evening"`), a haunted grove (`time: "night"`), a desert (`sandstorm`). Interiors are usually left clear.

---

## 8. Making it beautiful and fun

### 8.1 Layout

- **Frame every outdoor map** with trees on all sides, except where routes join. Two rows of trees look lush; use pines for colder places.
- **Paths lead somewhere**: from each door to the main road, from the main road to every exit. Two tiles wide for main roads, one for side paths.
- **Fill space with intent**: a pond with tall grass around it, a flower garden by a house, a fenced pen, a plaza with a sign. Empty grass looks unfinished, but leave walking space (at least 2 tiles) around buildings.
- **Put landmarks where the eye goes**: the Pokémon Center near the entrance, the gym at the end of the main road, the lab near the start.
- **Scale**: a starter town fits 3 to 5 buildings in 40×30. Leave the bottom row of every building clear in front of the door.

### 8.2 Pacing and balance

- Start: the Professor or Mom gives the first push (and a reward: Poké Balls, a Potion gift).
- The first route has the weakest Pokémon (levels 2 to 5) and one or two trainers just above them.
- Put a Pokémon Center before every gym.
- Gym Leaders: 2 or 3 Pokémon, the strongest about 3 to 5 levels above the route before. Gym trainers in between.
- A rival battle (`approach: true` trainer) right after the first story step feels great.
- Give side quests real rewards: money, a Pokémon, items.
- Every 3 to 5 tiles of walking, give the player something: a trainer, a sign, an item gift, a view.

### 8.3 Personality

- Give the town a theme (misty, coastal, volcanic, snowy) and carry it through names, Pokémon types, weather and dialogue.
- Name everyone. A Gym Leader with a title ("Iris, the Mist Dancer") is memorable.
- Use one or two story twists: someone who leaves after a step, a road that opens late, a legendary (`role: "wild"`) waiting at the end.

---

## 9. Checklist before you hand it over

- [ ] Every grid has exactly `width × height` numbers.
- [ ] Every building, tree trunk, water, fence and rock tile is `solid` 1. Every door, path, tall grass and flower tile is `solid` 0.
- [ ] Every door has a partner door back, and `to` matches a real map `id` (or `""`).
- [ ] The spawn is on a walkable tile.
- [ ] Nobody stands on a solid tile or outside their map.
- [ ] Every trainer has a team, every talker has dialogue, every sign has text.
- [ ] Every story step is completed by someone, and gates cover the whole opening.
- [ ] Every script `who` is a real index in that map's `npcs` (not an item), and every `step` action names a real step.
- [ ] Ledge landings are free, and nothing required sits behind surf water.
- [ ] Every outdoor map touches another map, with walkable, unroofed tiles facing each other on the shared edge.
- [ ] Every painted zone has creatures.
- [ ] At most 40 interiors and outdoor maps together.

After import, the editor's **Problems** list (bottom bar) checks most of this too.

---

## 10. The builder script

Copy this into `build-town.mjs`, keep part 1, replace part 2 with your game, and run `node build-town.mjs > my-game.city.json`. Part 2 here is a complete small game you can import as is: **Mistwood Town**, with a house, a lab, a Pokémon Center, a Poké Mart, a gym, Route 101 to the north (with a ledge shortcut and two items), a rival, a three-step story, a side quest and a small cutscene in the lab.

```js
// build-town.mjs: makes a DreamMist city file. Run: node build-town.mjs > my-town.city.json
// Part 1 is the kit (keep it as it is). Part 2 builds the game: change everything there.

// ============================================================================================
// Part 1: DreamMist kit
// ============================================================================================

/** Single tiles (values as stored in the city file: tileset frame + 1, 0 = empty) */
export const T = {
  grass: 114, tallGrass: 207, sand: 4978, gravel: 2608, pavement: 4975, water: 2375,
  flowers: 659, signPost: 206, smallTree: 95, dryBush: 208, boulder: 546, rocks: 547, fence: 1901, posts: 1907,
};

/** Terrains: 3×3 blocks [top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right] */
const terrain = (origin) => [0, 1, 2, 113, 114, 115, 226, 227, 228].map((offset) => origin + offset + 1);
export const TERRAIN = {
  meadow: terrain(22 * 113 + 1), sand: terrain(22 * 113 + 4), dirt: terrain(22 * 113 + 7),
  stone: terrain(22 * 113 + 13), tiles: terrain(22 * 113 + 16), brick: terrain(22 * 113 + 19),
};

/** Multi-tile stamps. `top` rows go on the above layer (walk behind them), `door` is the walkable door tile [column, row] */
const frames = (rows) => rows.map((row) => row.map((frame) => frame + 1));
export const STAMP = {
  tree: { tiles: frames([[211, 212], [324, 325]]), top: 1 },
  pine: { tiles: frames([[215, 216], [328, 329]]), top: 1 },
  house: { tiles: frames([[2734, 2735, 2735, 2735, 2740], [2847, 2848, 2848, 2848, 2853], [2960, 2961, 2961, 2961, 2966], [3073, 3076, 3077, 3074, 3079], [3186, 3189, 3190, 3187, 3192]]), door: [3, 4] },
  smallHouse: { tiles: frames([[3649, 3650, 3650, 3652], [3762, 3763, 3763, 3765], [3875, 3876, 3877, 3878], [3988, 3989, 3990, 3991]]), door: [1, 3] },
  lab: { tiles: frames([[474, 476, 477, 475, 475, 475, 478], [587, 589, 590, 588, 588, 588, 591], [587, 588, 588, 588, 588, 588, 591], [700, 702, 702, 706, 701, 705, 704], [813, 815, 815, 819, 814, 818, 817]]), door: [4, 4] },
  pokemonCenter: { tiles: frames([[22, 23, 24, 25], [135, 136, 137, 138], [248, 249, 250, 251], [361, 362, 363, 364]]), door: [1, 3] },
  pokeMart: { tiles: frames([[26, 27, 27, 29], [139, 140, 141, 142], [252, 253, 254, 255], [361, 362, 367, 368]]), door: [1, 3] },
};

let lastId = 0;
const uid = (prefix) => `${prefix}${(++lastId).toString(36)}`;

/** A blank map (the outside map, an interior or an outdoor map) */
export function map(name, width, height, ground = T.grass) {
  const size = width * height;
  return {
    id: uid("map"), name, width, height,
    layers: { ground: new Array(size).fill(ground), decor: new Array(size).fill(0), above: new Array(size).fill(0) },
    solid: new Array(size).fill(0), behavior: new Array(size).fill(0), zone: new Array(size).fill(0), gate: new Array(size).fill(0),
    npcs: [], doors: [], triggers: [], spawn: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
  };
}

/** The whole city: its outside map plus everything shared by all its maps */
export function city(name, author, width, height) {
  return { v: 1, ...map(name, width, height), author, zones: [], story: [], quests: [], interiors: [], updated: Date.now() };
}

const inside = (m, x, y) => (x >= 0) && (y >= 0) && (x < m.width) && (y < m.height);
/** Set one cell of a grid ("ground", "decor", "above", "solid", "behavior", "zone" or "gate") */
export function set(m, grid, x, y, value) {
  if (inside(m, x, y)) {
    (grid in m.layers ? m.layers[grid] : m[grid])[y * m.width + x] = value;
  }
}
export function get(m, grid, x, y) {
  return (grid in m.layers ? m.layers[grid] : m[grid])[y * m.width + x];
}
/** Fill a rectangle of a grid */
export function fill(m, grid, x, y, w, h, value) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(m, grid, x + i, y + j, value);
}
/** Walkable ground: sand, gravel or pavement paths */
export const path = (m, x, y, w, h, tile = T.sand) => fill(m, "ground", x, y, w, h, tile);
/** Water (blocked, or crossed by surfing with `surf`). Clears objects over it, like a grass patch drawn first */
export function water(m, x, y, w, h, surf = false) {
  fill(m, "ground", x, y, w, h, T.water);
  fill(m, "decor", x, y, w, h, 0);
  fill(m, "solid", x, y, w, h, 1);
  if (surf) fill(m, "behavior", x, y, w, h, B.surf);
}
/** Tile behaviors (the behavior grid) */
export const B = { ledgeDown: 1, ledgeUp: 2, ledgeLeft: 3, ledgeRight: 4, surf: 5, ice: 6, pushUp: 7, pushDown: 8, pushLeft: 9, pushRight: 10 };
/** Give a rectangle of tiles a behavior (ice and push tiles are made walkable) */
export function behave(m, x, y, w, h, value) {
  fill(m, "behavior", x, y, w, h, value);
  if (value >= B.ice) fill(m, "solid", x, y, w, h, 0);
}
/** Tall grass with an encounter zone (zone = index returned by `zone()`) */
export function tallGrass(m, x, y, w, h, zoneIndex) {
  fill(m, "decor", x, y, w, h, T.tallGrass);
  fill(m, "zone", x, y, w, h, zoneIndex);
}
/** Decorations people walk over (flowers) */
export const flowers = (m, x, y, w = 1, h = 1) => fill(m, "decor", x, y, w, h, T.flowers);
/** One blocking object (small tree, rock, fence, posts...) */
export function object(m, x, y, tile) {
  set(m, "decor", x, y, tile);
  set(m, "solid", x, y, 1);
}
/** A terrain patch with rounded borders (on the decor layer over grass, or on the ground for floors) */
export function patch(m, kind, x, y, w, h, grid = "decor") {
  const t = TERRAIN[kind];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const row = j === 0 ? 0 : j === h - 1 ? 2 : 1;
      const col = i === 0 ? 0 : i === w - 1 ? 2 : 1;
      set(m, grid, x + i, y + j, t[row * 3 + col]);
    }
  }
}
/** Place a stamp with its collision; returns the door tile of buildings */
export function stamp(m, name, x, y) {
  const { tiles, top = 0, door } = STAMP[name];
  tiles.forEach((row, j) => row.forEach((value, i) => {
    if (j < top) {
      set(m, "above", x + i, y + j, value);
    } else {
      set(m, "decor", x + i, y + j, value);
      set(m, "solid", x + i, y + j, 1);
    }
  }));
  return door ? { x: x + door[0], y: y + door[1] } : null;
}
/** Trees around the edge of a map, except where `gaps` are ({ top: [from, to], bottom, left, right } in tiles) */
export function treeBorder(m, gaps = {}, kind = "tree") {
  const open = (side, a) => gaps[side] && (a + 1 >= gaps[side][0]) && (a <= gaps[side][1]);
  for (let x = 0; x < m.width; x += 2) {
    if (!open("top", x)) stamp(m, kind, x, 0);
    if (!open("bottom", x)) stamp(m, kind, x, m.height - 2);
  }
  for (let y = 2; y < m.height - 2; y += 2) {
    if (!open("left", y)) stamp(m, kind, 0, y);
    if (!open("right", y)) stamp(m, kind, m.width - 2, y);
  }
}
/** A row of trees (w in tiles, even) */
export function treeRow(m, x, y, w, kind = "tree") {
  for (let i = 0; i < w; i += 2) stamp(m, kind, x + i, y);
}

/** A person (role "talk" by default). See the guide for every field */
export function person(m, fields) {
  const npc = { sprite: "generic_m1", dir: "down", name: "", dialogue: "", role: "talk", wander: false, ...fields };
  m.npcs.push(npc);
  set(m, "solid", npc.x, npc.y, 0);
  return npc;
}
/** A Pokémon standing on the map: role "talk" (says its cry) or "wild" (a battle, catchable once) */
export function pokemon(m, x, y, species, level, fields = {}) {
  return person(m, { x, y, sprite: "", creature: { species, level }, name: "", dialogue: "", ...fields });
}
/** A sign post the player can read */
export function sign(m, x, y, text) {
  object(m, x, y, T.signPost);
  m.npcs.push({ x, y, sprite: "", dir: "down", name: "Sign", dialogue: text, role: "talk", wander: false });
}

/** An item ball the player picks up (or an item hidden on the ground) */
export function item(m, x, y, id, count = 1, hidden = false) {
  const npc = { x, y, sprite: "", dir: "down", name: "", dialogue: "", role: "item", wander: false, gift: { item: id, count }, ...(hidden ? { hidden: true } : {}) };
  m.npcs.push(npc);
  set(m, "solid", x, y, 0);
  return npc;
}
/** Index of someone in their map's npcs, for script actions */
export const who = (m, npc) => m.npcs.indexOf(npc);
/** An event area that plays a cutscene when the player steps in: trigger(m, { x, y, w, h, name, once, after, until, actions }) */
export function trigger(m, { after, until, ...fields }) {
  const t = { id: uid("event"), w: 1, h: 1, name: "Event", once: true, actions: [], ...fields, ...(after ? { after: after.id } : {}), ...(until ? { until: until.id } : {}) };
  m.triggers.push(t);
  return t;
}

/** An encounter zone, returns its index for tallGrass() */
export function zone(c, name, creatures, rate = 0.12) {
  c.zones.push({ name, rate, color: [0x2ecc40, 0x0074d9, 0xff851b, 0xb10dc9, 0xffdc00, 0x39cccc][c.zones.length % 6], creatures });
  return c.zones.length;
}

/** An interior (walls, floor, an exit door at the bottom) linked both ways to a door tile on another map */
export function interior(c, name, from, door, { width = 14, height = 10, floor = "tiles" } = {}) {
  const room = map(name, width, height, TERRAIN[floor][4]);
  for (let x = 0; x < width; x++) for (const y of [0, 1, height - 1]) set(room, "solid", x, y, 1);
  for (let y = 0; y < height; y++) for (const x of [0, width - 1]) set(room, "solid", x, y, 1);
  const exit = { x: Math.floor(width / 2), y: height - 1 };
  set(room, "solid", exit.x, exit.y, 0);
  room.spawn = { x: exit.x, y: height - 2 };
  c.interiors.push(room);
  link(c, from, door, room, exit);
  return room;
}
/** Two-way doors between two maps (the player arrives next to the door leading back) */
export function link(c, a, at, b, bt) {
  const id = (m) => m === c ? "" : m.id;
  set(a, "solid", at.x, at.y, 0);
  set(b, "solid", bt.x, bt.y, 0);
  a.doors.push({ x: at.x, y: at.y, to: id(b), tx: -1, ty: -1 });
  b.doors.push({ x: bt.x, y: bt.y, to: id(a), tx: -1, ty: -1 });
}
/** An outdoor map (route, another town) placed on the region grid: walking off an edge lands on the map touching it */
export function outdoor(c, name, width, height, x, y) {
  const m = { ...map(name, width, height), outdoor: true, region: { x, y } };
  c.interiors.push(m);
  return m;
}

/** A story step (main story, or a side quest's step with `quest`); returns it for gates and people */
export function step(c, fields) {
  const s = { id: uid("step"), n: Math.max(0, ...c.story.map(({ n }) => n)) + 1, blocked: "The way is blocked for now.", ...fields };
  c.story.push(s);
  return s;
}
/** A side quest; its steps are made with step(c, { quest: q.id, ... }) */
export function quest(c, name, after) {
  const q = { id: uid("quest"), name, ...(after ? { after: after.id } : {}) };
  c.quests.push(q);
  return q;
}
/** Tiles that stay blocked until a step is done */
export const gate = (m, s, x, y, w = 1, h = 1) => fill(m, "gate", x, y, w, h, s.n);

/** Check the city and print it as JSON */
export function finish(c) {
  const maps = [c, ...c.interiors];
  const ids = new Set(["", ...c.interiors.map(({ id }) => id)]);
  const problems = [];
  for (const m of maps) {
    const size = m.width * m.height;
    for (const grid of ["solid", "behavior", "zone", "gate"]) if (m[grid].length !== size) problems.push(`${m.name}: ${grid} has the wrong length`);
    for (const t of m.triggers) for (const a of t.actions) if ((typeof a.who === "number") && !m.npcs[a.who]) problems.push(`${m.name}: event ${t.name} is about someone who isn't there`);
    for (const layer of ["ground", "decor", "above"]) if (m.layers[layer].length !== size) problems.push(`${m.name}: ${layer} has the wrong length`);
    for (const d of m.doors) if (!ids.has(d.to)) problems.push(`${m.name}: door at ${d.x},${d.y} leads to a missing map`);
    for (const p of m.npcs) {
      if (!inside(m, p.x, p.y)) problems.push(`${m.name}: ${p.name || "someone"} stands outside the map`);
      if ((p.role === "trainer") && (!p.trainer?.team?.length)) problems.push(`${m.name}: trainer ${p.name} has no team`);
    }
  }
  if (c.interiors.length > 40) problems.push("More than 40 interiors and outdoor maps");
  if (get(c, "solid", c.spawn.x, c.spawn.y)) problems.push("The spawn is on a blocked tile");
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(c));
}

// ============================================================================================
// Part 2: the game. Change everything below.
// ============================================================================================

const town = city("Mistwood Town", "An agent", 40, 30);

// Wild Pokémon (species are national Pokédex numbers)
const routeGrass = zone(town, "Route 101 grass", [
  { species: 263, min: 2, max: 4 }, // Zigzagoon
  { species: 265, min: 2, max: 3 }, // Wurmple
  { species: 261, min: 3, max: 4 }, // Poochyena
  { species: 280, min: 4, max: 5 }, // Ralts (rare in the mix)
]);
const pondGrass = zone(town, "Pond", [
  { species: 270, min: 3, max: 5 }, // Lotad in the grass by the pond
  { species: 183, min: 3, max: 5 }, // Marill
  { species: 129, min: 5, max: 10, method: "fish" }, // Magikarp, any rod
  { species: 118, min: 8, max: 12, method: "fish", rod: "good" }, // Goldeen, Good Rod or better
  { species: 163, min: 4, max: 6, time: "night" }, // Hoothoot, only at night
], 0.1);

// The story
const meetProf = step(town, { name: "Meet the Professor", goal: "Visit Professor Birch in his lab", blocked: "A small tree blocks the road north. Maybe the Professor knows the way.", blocker: "object", tile: T.smallTree });
const beatRival = step(town, { name: "Beat your rival", goal: "Wally waits at the north exit" });
const winBadge = step(town, { name: "Win the Mist Badge", goal: "Challenge the Gym Leader" });
const lostSkitty = quest(town, "Lost Skitty", meetProf);
const askHelp = step(town, { quest: lostSkitty.id, name: "Accept the quest", goal: "Talk to Lily by the pond" });
const findSkitty = step(town, { quest: lostSkitty.id, name: "Find Skitty", goal: "Look for Skitty on Route 101" });
const bringBack = step(town, { quest: lostSkitty.id, name: "Bring Skitty home", goal: "Tell Lily you found her Skitty" });

// Outside: trees around, a way out north (columns 18 to 21), paths, a pond
treeBorder(town, { top: [18, 21] });
path(town, 19, 0, 2, 26);
path(town, 4, 15, 32, 2);
patch(town, "meadow", 26, 19, 9, 6);
water(town, 28, 21, 5, 3);
fill(town, "zone", 28, 21, 5, 3, pondGrass); // the pond's fish
tallGrass(town, 27, 24, 7, 2, pondGrass);
item(town, 27, 20, "old-rod"); // an Old Rod by the pond: face the water and press Space
flowers(town, 14, 12, 2, 1);
flowers(town, 23, 12, 3, 1);
flowers(town, 6, 20, 2, 1);
const home = stamp(town, "house", 5, 9);
const lab = stamp(town, "lab", 23, 6);
const center = stamp(town, "pokemonCenter", 8, 19);
const mart = stamp(town, "pokeMart", 13, 19);
const gym = stamp(town, "house", 30, 8);
path(town, home.x, home.y + 1, 1, 5);
path(town, lab.x, lab.y + 1, 1, 8);
sign(town, 17, 13, "Mistwood Town\n\nWhere the morning mist hides the road north.");
sign(town, 29, 13, "Mistwood Gym\n\nLeader: Iris, the Mist Dancer.");
// The road north stays closed until the Professor has seen you (the whole 4-tile gap, drawn as a small tree)
gate(town, meetProf, 18, 2, 4, 1);
town.spawn = { x: 19, y: 18 };
town.time = "evening";

// People outside
person(town, { x: 16, y: 17, sprite: "generic_m2", name: "Ezra", dialogue: "Tall grass on Route 101 is full of wild Pokémon.\n\nAlways heal at the Pokémon Center first!", wander: true });
person(town, { x: 26, y: 18, sprite: "twin", name: "Lily", dir: "right", dialogue: "My Skitty ran off to Route 101...", story: { until: findSkitty.id, completes: askHelp.id, done: "Please find my Skitty!" } });
person(town, { x: 25, y: 18, sprite: "twin", name: "Lily", dir: "right", dialogue: "You found her! Thank you so much!", story: { after: findSkitty.id, completes: bringBack.id, reward: { money: 500 }, done: "Skitty and I will never forget you." } });
person(town, { x: 20, y: 4, sprite: "wally", name: "Wally", dir: "down", approach: true, dialogue: "Hey! You're the new trainer, right?\n\nLet's see how strong you are!", role: "trainer", trainer: { team: [{ species: 280, level: 6 }], gym: false, badge: "", defeat: "Wow... you're really good." }, story: { after: meetProf.id, completes: beatRival.id, done: "I'll train harder. See you around!" } });

// Your house
const house = interior(town, "Your House", town, home);
person(house, { x: 5, y: 4, sprite: "mom", name: "Mom", dialogue: "Off on your adventure? Take these, just in case.", gift: { item: "potion", count: 3 }, wander: true });

// The lab
const labRoom = interior(town, "Birch Lab", town, lab, { width: 16, height: 12, floor: "stone" });
person(labRoom, { x: 8, y: 4, sprite: "scientist", name: "Prof. Birch", dialogue: "Ah, there you are! The world is full of Pokémon.\n\nTake these Poké Balls and go explore Route 101!", story: { completes: meetProf.id, reward: { balls: 5 }, done: "Have you met Wally yet? He went north." } });
const aide = person(labRoom, { x: 4, y: 6, sprite: "generic_f2", name: "Aide", dialogue: "The Professor studies how Pokémon live in the wild.", wander: true });
// A small cutscene: the first time the player walks in, the aide comes over (the row just inside the door)
trigger(labRoom, { x: 1, y: 9, w: 14, h: 1, name: "Welcome to the lab", until: meetProf, actions: [
  { do: "come", who: who(labRoom, aide) },
  { do: "say", who: who(labRoom, aide), text: "Oh, you must be the new trainer!\n\nThe Professor is waiting for you at the back." },
] });

// Pokémon Center and Mart
const centerRoom = interior(town, "Pokémon Center", town, center, { floor: "stone" });
person(centerRoom, { x: 7, y: 3, sprite: "shopkeeper_f", name: "Nurse", role: "healer", dialogue: "Welcome to the Pokémon Center! Let me heal your Pokémon." });
const martRoom = interior(town, "Poké Mart", town, mart, { floor: "stone" });
person(martRoom, { x: 7, y: 3, sprite: "shopkeeper_m", name: "Clerk", role: "shop", shop: ["poke-ball", "potion", "full-heal"], dialogue: "Welcome! How may I help you?" });

// The gym: its leader waits for the rival battle
const gymRoom = interior(town, "Mistwood Gym", town, gym, { width: 14, height: 14, floor: "brick" });
person(gymRoom, { x: 7, y: 3, sprite: "roxanne", name: "Iris", dialogue: "So you're the trainer everyone talks about. Show me!", role: "trainer", trainer: { team: [{ species: 280, level: 9 }, { species: 183, level: 10 }], gym: true, badge: "Mist Badge", defeat: "Beautiful! The Mist Badge is yours." }, story: { requires: beatRival.id, locked: "Beat your rival Wally first, then come back.", completes: winBadge.id, done: "Keep training, champion." } });
person(gymRoom, { x: 4, y: 8, sprite: "lass", name: "Lass Mia", dir: "right", dialogue: "You won't reach Iris that easily!", role: "trainer", trainer: { team: [{ species: 298, level: 7 }], gym: false, badge: "", defeat: "Iris is way tougher than me." } });

// Route 101: an outdoor map right above the town, joined at the gap in the trees
const route = outdoor(town, "Route 101", 20, 40, 10, -40);
for (let y = 0; y < 40; y += 2) {
  stamp(route, "tree", 0, y);
  stamp(route, "tree", 18, y);
}
path(route, 9, 0, 2, 40);
tallGrass(route, 3, 8, 5, 6, routeGrass);
tallGrass(route, 12, 20, 5, 7, routeGrass);
tallGrass(route, 3, 28, 5, 5, routeGrass);
sign(route, 8, 37, "Route 101\n\nNorth: Petalburg City");
// A ledge shortcut west of the path: hop down going south, walk around going north
behave(route, 2, 18, 7, 1, B.ledgeDown);
// Items: a ball in the east grass, one hidden by the trees
item(route, 15, 31, "super-potion");
item(route, 2, 36, "great-ball", 2, true);
person(route, { x: 13, y: 14, sprite: "youngster", name: "Youngster Joey", dir: "left", dialogue: "My Zigzagoon is in the top percentage!", role: "trainer", trainer: { team: [{ species: 263, level: 5 }], gym: false, badge: "", defeat: "Aww, my Zigzagoon..." } });
pokemon(route, 5, 26, 300, 5, { dialogue: "Mew?", story: { after: askHelp.id, completes: findSkitty.id, done: "Skitty went home to Lily." } });
route.time = "evening";
route.weather = "fog";

finish(town);
```

### What the kit gives you

| Function | Does |
| --- | --- |
| `city(name, author, w, h)` | The city with its outside map |
| `map(name, w, h, ground)` | A blank map (used by the others) |
| `set / get / fill(m, grid, …)` | Any grid: `"ground"`, `"decor"`, `"above"`, `"solid"`, `"behavior"`, `"zone"`, `"gate"` |
| `path(m, x, y, w, h, tile)` | Paths (sand by default) |
| `water(m, x, y, w, h, surf)` | Water, solid (crossed by surfing with `surf: true`) |
| `behave(m, x, y, w, h, B.value)` | Ledges, surf water, ice and push tiles (2.4) |
| `tallGrass(m, x, y, w, h, zone)` | Tall grass with encounters |
| `flowers(m, x, y, w, h)` | Flowers |
| `object(m, x, y, tile)` | One solid object (fence, rock, small tree…) |
| `patch(m, terrain, x, y, w, h)` | A terrain patch with borders |
| `stamp(m, name, x, y)` | A tree or building with collision; returns the door tile `{x, y}` |
| `treeBorder(m, gaps, kind)` | Trees around the map, with gaps like `{ top: [18, 21] }` |
| `treeRow(m, x, y, w, kind)` | A row of trees |
| `person(m, fields)` | A person (section 5) |
| `pokemon(m, x, y, species, level, fields)` | A Pokémon on the map |
| `sign(m, x, y, text)` | A sign post you can read |
| `item(m, x, y, id, count, hidden)` | An item ball, or a hidden item |
| `trigger(m, { x, y, w, h, name, once, after, until, actions })` | An event area playing a cutscene (6.1); `after`/`until` take steps |
| `who(m, npc)` | Someone's index in their map, for script actions |
| `zone(c, name, creatures, rate)` | An encounter zone; returns its number |
| `interior(c, name, fromMap, door, { width, height, floor })` | A room with walls and a two-way door |
| `link(c, mapA, tileA, mapB, tileB)` | Two-way doors between any two maps |
| `outdoor(c, name, w, h, regionX, regionY)` | A route or town on the region grid |
| `step(c, fields)` / `quest(c, name, after)` | Story steps and side quests |
| `gate(m, step, x, y, w, h)` | Tiles blocked until a step is done |
| `finish(c)` | Checks the city and prints the JSON |
