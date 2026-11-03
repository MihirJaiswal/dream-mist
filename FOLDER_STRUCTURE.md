# Folder structure

DreamMist is one Next.js app. The website, the docs and the editor all live in `src/app`, and online features run on Supabase.

```
.
├── src/
│   ├── app/                  Next.js routes (App Router)
│   │   ├── (site)/           Home page and Explore, with the site header and footer
│   │   ├── docs/             Docs pages, rendered from content/docs by Fumadocs
│   │   ├── editor/           /editor, the town builder and game (loaded in the browser only)
│   │   ├── api/search/       Search index for the docs
│   │   ├── layout.tsx        Root layout (fonts, theme)
│   │   └── globals.css       Tailwind setup, color tokens, landing page styles
│   │
│   ├── game/                 Game engine: plain TypeScript, no React
│   │   ├── session.ts        App logic: open, save, switch modes, rooms, uploads. React reads it through `subscribe`
│   │   ├── editor/           Editor state and tools (engine.ts) and their constants
│   │   ├── map.ts            Draws a city with PixiJS: layers, zoom, drag, overlays
│   │   ├── region.ts         Routes and towns joined at their edges: positions, neighbors, crossing an edge
│   │   ├── atmosphere.ts     Weather and time of day drawn over the map in play mode
│   │   ├── play.ts           Play mode: walking, talking, doors, wild Pokémon, trainers, tile behaviors, scripts
│   │   ├── behaviors.ts      Tile behaviors painted on the Collision layer: ledges, surf water, ice, push tiles
│   │   ├── encounters.ts     Wild Pokémon a zone offers: walking, surfing or fishing, by part of the day and rod
│   │   ├── abilities.ts      Abilities that change battles (Intimidate, Levitate, Static…)
│   │   ├── natures.ts        The 25 natures and the stats they raise and lower
│   │   ├── scripts.ts        Event script actions: their names, checking imported ones, fixing them when people are removed
│   │   ├── battle.ts         Battles: damage, stat changes, conditions, catching, turns. Keeps a `view` the React battle screen draws
│   │   ├── story.ts          Story lanes: main story and side quests, the Journal and progress banners
│   │   ├── problems.ts       Finds what's broken in a town (doors, people, events, spawn, zones, story) for the Problems list
│   │   ├── trainer.ts        Your trainer and party: stats, levels, moves, evolution, bag and money
│   │   ├── items.ts          Items sold in the Poké Mart: balls, potions, Full Heal
│   │   ├── data.ts           City format, browser saves, share codes, resizing and repairing cities
│   │   ├── assets.ts         Loads textures, the Pokédex and tile data; Pokémon sprites and artwork
│   │   ├── brushes.ts        Built-in stamps (grass, paths, trees, houses…)
│   │   ├── tilesets.ts       Custom tilesets uploaded by players
│   │   ├── sprites.ts        Custom people and Pokémon sprites, sheet layouts
│   │   ├── hoenn.ts          Turns real Hoenn maps into starting cities
│   │   ├── cloud.ts          Supabase calls: accounts, saved cities, Explore, likes, uploads
│   │   ├── room.ts           Live building with friends over Supabase Realtime
│   │   ├── audio.ts          Music and sound effects
│   │   └── ui-bridge.ts      How the engine asks React for dialogs, toasts and dialogue
│   │
│   ├── components/
│   │   ├── editor/           React UI of the editor: top bar, tool rail, side panels, dialogs,
│   │   │                     battle screen, dialogue box, minimap. Entry point: editor-app.tsx
│   │   ├── site/             Website components: header, footer, city cards, landing page sections
│   │   └── ui/               shadcn/ui components (button, dialog, select, tabs…), used by the editor
│   │
│   ├── lib/
│   │   ├── supabase.ts       Shared Supabase client (reads the NEXT_PUBLIC_SUPABASE_* variables)
│   │   ├── api.ts            Website data: signed-in user, Explore, likes
│   │   ├── source.ts         Fumadocs content source
│   │   └── utils.ts          `cn()` class name helper
│   └── mdx-components.tsx    Components available inside docs pages
│
├── content/docs/             The docs, one .mdx file per page. Order and sections in meta.json
│
├── public/
│   ├── game/                 Files the game loads (built by `npm run data`, committed)
│   │   ├── textures/         Sprite sheets for tiles, people and Pokémon (people.* is every Emerald overworld person)
│   │   ├── battle/           Emerald battle scenes (built from pret/pokeemerald)
│   │   ├── tilesets/emerald/ Every Emerald tileset as a 16px tile sheet, and index.json (built from pret/pokeemerald)
│   │   ├── data/             Pokédex, walkable tiles, tile animations, Hoenn map sections
│   │   ├── audio/            Default music and sound effects
│   │   └── images/           Logo and loading art used by the editor
│   ├── site/                 Landing page art and sprites
│   └── agents.md             Guide for AI agents to write whole games as .city.json files (served at /agents.md)
│
├── maps/                     Source Hoenn maps made with Tiled (.tmx), placed by hoenn.world
├── copyrighted/              Source textures and audio from the Pokémon games
├── scripts/
│   ├── build-data.mts        Builds public/game from maps/, copyrighted/, PokeAPI data and pret graphics
│   └── pret.mts              Turns pret/pokeemerald graphics (GBA tiles, tile maps, palettes) into battle scenes, people and tilesets
│
├── supabase/migrations/      Database schema: tables, row level security, functions, storage bucket, version history.
│                             Run new files in order in the Supabase SQL Editor
├── tests/                    Vitest tests: city data, battles, editor helpers, game files, database rules
│
├── .husky/                   Git hooks: lint staged files on commit, typecheck and test on push
├── .cache/                   PokeAPI download for `npm run data` (ignored by git)
├── .env.example              Supabase variables to copy into .env.local
├── components.json           shadcn/ui settings
├── eslint.config.mjs         ESLint rules (Next.js, React hooks, TypeScript)
├── next.config.mjs           Next.js settings (docs, redirect from the old /city.html)
├── source.config.ts          Fumadocs settings
├── vitest.config.mts         Test settings
└── tsconfig.json             TypeScript settings (`@/` points to src/)
```

## How the editor fits together

- `src/app/editor/page.tsx` loads `components/editor/editor-app.tsx` in the browser only, since PixiJS needs a canvas.
- `editor-app.tsx` installs the UI bridge (dialogs, toasts, dialogue) and calls `session.boot()`.
- The engine in `src/game` never imports React. React components read it with `useSession()` and `useEditor()` from `components/editor/hooks.ts`, which re-render whenever the engine notifies.
- Panels call engine methods directly, for example `editor.setTool("brush")` or `session.publish(...)`.

## Where to change things

| To change                                | Look in                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A panel, dialog or button in the editor  | `src/components/editor/`                                                                                          |
| What a tool does on the map              | `src/game/editor/engine.ts`                                                                                       |
| Walking, talking, doors, encounters      | `src/game/play.ts`                                                                                                |
| Ledges, surf, ice and push tiles         | `src/game/behaviors.ts` (values), `src/game/play.ts` (movement), `drawBehaviors` in `src/game/map.ts`             |
| Event script actions                     | `src/game/scripts.ts`, `#act` in `src/game/play.ts`, `src/components/editor/script-editor.tsx`                    |
| Battle rules                             | `src/game/battle.ts`, `src/game/trainer.ts`, `src/game/abilities.ts` and `src/game/natures.ts`                    |
| Wild encounters, fishing                 | `src/game/encounters.ts`, `#stepped` and `#fish` in `src/game/play.ts`, `src/components/editor/zones-panel.tsx`   |
| Emerald graphics (pret)                  | `scripts/pret.mts`, rebuilt with `npm run data -- pret --force`                                                   |
| The city file format                     | `src/game/data.ts` (update `sanitize` and the docs page `city-file.mdx`)                                          |
| Saving, accounts, Explore                | `src/game/cloud.ts` and `supabase/migrations/`                                                                    |
| Live rooms                               | `src/game/room.ts`                                                                                                |
| Problems list checks                     | `src/game/problems.ts`                                                                                            |
| Command search (⌘K)                      | `src/components/editor/command-palette.tsx`                                                                       |
| Keyboard shortcuts and the ? cheat sheet | `src/components/editor/shortcuts.tsx` (app-wide) and the `#keys` handler in `src/game/editor/engine.ts` (editing) |
| Getting started tour                     | `src/components/editor/tour.tsx`                                                                                  |
| Home page or Explore                     | `src/app/(site)/` and `src/components/site/`                                                                      |
| Docs                                     | `content/docs/`                                                                                                   |
