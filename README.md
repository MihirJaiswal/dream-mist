# DreamMist

Make your own Pokémon game, play it, and share it with friends.

DreamMist is a browser-based Pokémon game maker for fans. Paint maps with the Generation 3 tileset, place people, Pokémon and signs, write a small story with events that unlock paths, add interiors, then play it with battles and catching. Publish it to Explore so others can play, like and fork it.

## Features

- **Editor**: ground, object and above-player layers, stamps, auto-bordering terrains, select / copy / paste, random brush, minimap, undo / redo, real Hoenn towns and routes to start from.
- **Story**: a timeline of steps, gates blocked by walls, objects or people, people who appear, leave, need steps, complete them and hand out rewards.
- **Play**: walking, trainers with line of sight, gyms and badges, wild encounters, all 1,025 Pokémon with real types, stats and moves, doors into interiors.
- **Together**: Google accounts, online saves, live building rooms, publish, Explore, likes and forks.
- **Website**: landing page, Explore gallery and docs.

## Make a game with an AI agent

A game is one `.city.json` file, so an agent can write it. Give your agent [`public/agents.md`](public/agents.md) (served at `/agents.md`): it covers the file format, a tile catalog, people, story, doors and routes, and has a builder script that makes a complete game. Import the result from **Your cities → Import file**. A test (`tests/agents-guide.test.ts`) runs the guide's script and checks its game imports with no problems.

## Stack

- [Next.js](https://nextjs.org) (App Router) with React, [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- [PixiJS](https://pixijs.com) for the map, in a framework-free engine under `src/game`
- [Supabase](https://supabase.com) for accounts, the database, file uploads and live rooms
- [Fumadocs](https://fumadocs.dev) for the docs, [Vitest](https://vitest.dev) for tests

See [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) for what lives where.

## Run it

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The editor is at `/editor`.

`npm install` also sets up Git hooks with Husky: each commit lints and fixes the staged files, and each push runs the typecheck and tests first.

Without Supabase, everything works offline: cities and your trainer are saved in the browser. Online features (log in, Explore, publish, short links, live rooms, uploads) need a Supabase project, see below.

| Command                       | What it does                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Website, docs and editor with hot reload                                                          |
| `npm run build` / `npm start` | Production build and server                                                                       |
| `npm test`                    | Run the tests                                                                                     |
| `npm run typecheck`           | Check types                                                                                       |
| `npm run lint`                | Check the code with ESLint                                                                        |
| `npm run data`                | Rebuild `public/game` from `maps/`, `copyrighted/` and PokeAPI (only needed after changing those) |

## Going online (Supabase and Vercel)

Both have free plans that are enough for playing with friends.

### 1. Create the database

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor** and run each file in `supabase/migrations/` in order (oldest first): paste the whole file and press **Run**. They create the tables, access rules, the `assets` storage bucket and version history.
3. Open **Project Settings → API** (or the **Connect** button) and copy the **Project URL** and the **publishable key** (older projects call it the **anon** key).

### 2. Connect your computer

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Restart `npm run dev`.

### 3. Google sign-in

DreamMist accounts sign in with Google only.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create a project if you don't have one, then set up the **OAuth consent screen** (External, with your app name and email). While it's in testing, add your friends' Gmail addresses as **test users**, or publish the app.
2. Create an **OAuth client ID** of type **Web application**. Under **Authorized redirect URIs**, add `https://your-project.supabase.co/auth/v1/callback` (your Project URL with `/auth/v1/callback` at the end).
3. In Supabase, open **Authentication → Sign In / Providers → Google**, turn it on, paste the **Client ID** and **Client secret**, and save.
4. In Supabase, open **Authentication → URL Configuration**:
   - **Site URL**: your website, for example `https://your-app.vercel.app`
   - **Redirect URLs**: add `http://localhost:3000/**`, `http://localhost:3001/**` and `https://your-app.vercel.app/**`

New players get a username from their Google name, shown on the towns they publish.

### 4. Deploy on Vercel

1. Import the GitHub repository at [vercel.com/new](https://vercel.com/new). Keep the **Root Directory** as the repository root and the framework as Next.js.
2. Add the two `NEXT_PUBLIC_SUPABASE_*` variables under **Environment Variables**.
3. Deploy. Old `/city.html` links redirect to `/editor`.

Free Supabase projects pause after a week without visits. Open the dashboard and press **Restore** if that happens.

## Assets

Pokémon and its assets belong to Nintendo, Game Freak and The Pokémon Company. This is a private, non-commercial fan project.

Emerald battle scenes, overworld people and tilesets are extracted from the [pret/pokeemerald](https://github.com/pret/pokeemerald) decompilation by `npm run data -- pret`. Pokédex data comes from [PokeAPI](https://github.com/PokeAPI/api-data).
