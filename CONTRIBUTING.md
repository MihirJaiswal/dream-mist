# Contributing to DreamMist

Thanks for helping. This page covers how to run the project, what the Git hooks check and how the code is written.

By contributing you agree that your code is released under the project's [GNU AGPL v3](LICENSE) license, and you follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs**: open an issue with the steps to reproduce it. A `.city.json` file or a share link helps a lot.
- **Ideas and bigger changes**: open an issue first so we can agree on the approach before you write the code.
- **Security problems**: don't open a public issue, see [SECURITY.md](SECURITY.md).
- **Assets**: don't add Pokémon graphics, music or other files you didn't make unless they come from a source already listed in [NOTICE.md](NOTICE.md). Say where every new asset comes from in your pull request.

## Set up

Requires Node 22 or newer and npm (the lockfile is `package-lock.json`, so don't use pnpm or Yarn).

```bash
npm install
npm run dev
```

Open http://localhost:3000. Everything except online features works without Supabase. To test log in, Explore, publishing or live rooms, set up your own Supabase project as the [README](README.md#going-online-supabase-and-cloudflare) explains.

## Commands

| Command              | What it does                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`        | Website, docs and editor with hot reload                                                  |
| `npm run build`      | Production build                                                                          |
| `npm test`           | Run the tests once (Vitest, files in `tests/`)                                            |
| `npm run test:watch` | Run the tests on every change                                                             |
| `npm run typecheck`  | Check types with `tsc`                                                                    |
| `npm run lint`       | Check the code with ESLint                                                                |
| `npm run format`     | Format everything with Prettier                                                           |
| `npm run data`       | Rebuild `public/game` from `maps/`, `copyrighted/` and PokeAPI (only after changing them) |

## Git hooks

`npm install` sets up the hooks with Husky (`.husky/`):

- **On commit**: lint-staged runs Prettier and `eslint --fix` on the staged `.ts`, `.tsx`, `.mts` and `.mjs` files, and Prettier on staged `.css`, `.json` and `.md` files.
- **On push**: `npm run typecheck` and `npm test` must pass.

Don't skip them with `--no-verify`. If a hook fails, fix the problem and try again.

## Code style

- Prettier owns formatting (160 columns, double quotes, trailing commas). ESLint owns code quality. Both run on commit.
- Write code that reads like the code around it: same naming, same idioms, same amount of comments. Exported types and functions get a short `/** ... */` line saying what they are, and `//Comments` (no space after the slashes) explain the why of a tricky line. Don't add comments that only repeat the code.
- The game engine in `src/game` is plain TypeScript with no React. React components read it through `session.subscribe` and the UI bridge. Keep that split.
- UI uses Tailwind and the shadcn/ui components in `src/components/ui`.
- [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) explains what lives where. Update it when you add or move folders.
- Changes to what players see go with the docs page that describes them, in `content/docs/`. Changes to the city file format also update [`public/agents.md`](public/agents.md); `tests/agents-guide.test.ts` checks that its builder script still makes a valid game.
- Changes to the database schema go in a new file in `supabase/migrations/`, named with a timestamp so it sorts after the others. Never edit a migration that is already on `main`.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep each pull request to one change. Add or update tests in `tests/` for game logic.
3. Commit messages start with a type: `feat:`, `fix:`, `polish:`, `docs:`, `chore:` or `test:`, then say what changed for players, for example `fix: trainers see you across ledges`.
4. Make sure `npm run typecheck`, `npm run lint` and `npm test` pass, then open the pull request and fill in the template.
