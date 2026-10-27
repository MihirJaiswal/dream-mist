# DreamMist

Build your own Pokémon town, play it, and share it with friends.

DreamMist is a browser-based town builder for Pokémon fans. Paint maps with the Generation 3 tileset, place people, Pokémon and signs, write a small story with events that unlock paths, add interiors, then play it with battles and catching. Publish it to Explore so others can play, like and fork it.

## Features

- **Editor**: ground, object and above-player layers, stamps, auto-bordering terrains, select / copy / paste, random brush, minimap, undo / redo, real Hoenn towns and routes to start from.
- **Story**: a timeline of steps, gates blocked by walls, objects or people, people who appear, leave, need steps, complete them and hand out rewards.
- **Play**: walking, trainers with line of sight, gyms and badges, wild encounters, all 1,025 Pokémon with real types, stats and moves, doors into interiors.
- **Together**: accounts (email or Google), online saves, live building rooms, publish, Explore, likes and forks.
- **Website**: landing page, Explore gallery and docs.

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

Without Supabase, everything works offline: cities and your trainer are saved in the browser. Online features (log in, Explore, publish, short links, live rooms, uploads) need a Supabase project, see below.

| Command | What it does |
| --- | --- |
| `npm run dev` | Website, docs and editor with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Run the tests |
| `npm run typecheck` | Check types |
| `npm run data` | Rebuild `public/game` from `maps/`, `copyrighted/` and PokeAPI (only needed after changing those) |

## Going online (Supabase and Vercel)

Both have free plans that are enough for playing with friends.

### 1. Create the database

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste the whole of `supabase/migrations/20261027000000_dreammist.sql`, and press **Run**. It creates the tables, access rules and the `assets` storage bucket.
3. Open **Project Settings → API** (or the **Connect** button) and copy the **Project URL** and the **publishable key** (older projects call it the **anon** key).

### 2. Connect your computer

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Restart `npm run dev`.

### 3. Sign-in settings

In Supabase, open **Authentication → URL Configuration**:

- **Site URL**: your website, for example `https://your-app.vercel.app`
- **Redirect URLs**: add `http://localhost:3000/**` and `https://your-app.vercel.app/**`

Email sign-in works right away. By default new accounts must confirm their email first; for a small group of friends you can turn that off in **Authentication → Sign In / Providers → Email → Confirm email**. The built-in email sender only sends a few emails per hour.

**Google sign-in** (optional):

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type **Web application**.
2. Add the **Authorized redirect URI** `https://your-project.supabase.co/auth/v1/callback`.
3. In Supabase, open **Authentication → Sign In / Providers → Google**, turn it on and paste the client ID and secret.

### 4. Deploy on Vercel

1. Import the GitHub repository at [vercel.com/new](https://vercel.com/new). Keep the **Root Directory** as the repository root and the framework as Next.js.
2. Add the two `NEXT_PUBLIC_SUPABASE_*` variables under **Environment Variables**.
3. Deploy. Old `/city.html` links redirect to `/editor`.

Free Supabase projects pause after a week without visits. Open the dashboard and press **Restore** if that happens.

## Assets

Pokémon and its assets belong to Nintendo, Game Freak and The Pokémon Company. This is a private, non-commercial fan project.
