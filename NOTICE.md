# Notice

DreamMist is a non-commercial fan project. It is not affiliated with, endorsed, sponsored or approved by Nintendo, Game Freak, Creatures Inc. or The Pokémon Company.

Pokémon and Pokémon character names are trademarks of Nintendo. © 1995–2026 Nintendo / Creatures Inc. / GAME FREAK inc.

## What the license covers

The [LICENSE](LICENSE) (GNU AGPL v3) covers the **source code** of DreamMist only: `src/`, `scripts/`, `tests/`, `supabase/`, `content/` and the config files at the repository root.

It does **not** cover the game assets. They belong to their owners, and nobody in this project can relicense them:

| Where                                                                                                 | What                                                                                                  | Owner                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `copyrighted/`, `public/game/` (sprites, tilesets, battle backgrounds, items, intro, audio, textures) | Pokémon graphics, Ruby / Sapphire / Emerald tilesets, battle scenes, music and sounds                 | Nintendo / Creatures Inc. / GAME FREAK inc.                                                                  |
| `public/game/` (extracted by `npm run data -- pret`)                                                  | Emerald graphics, read from the [pret/pokeemerald](https://github.com/pret/pokeemerald) decompilation | Nintendo / Creatures Inc. / GAME FREAK inc.                                                                  |
| `public/game/followers/`, newer item icons                                                            | Graphics from [pokeemerald-expansion](https://github.com/rh-hideout/pokeemerald-expansion)            | Nintendo / Creatures Inc. / GAME FREAK inc., and the artists credited by pokeemerald-expansion               |
| `public/game/data/` (Pokédex)                                                                         | Species, moves and stats from [PokeAPI](https://github.com/PokeAPI/api-data)                          | Pokémon data © Nintendo / Creatures Inc. / GAME FREAK inc., compiled by PokeAPI                              |
| Sprite URLs under `raw.githubusercontent.com/PokeAPI/sprites`                                         | Pokémon sprites loaded at runtime                                                                     | Nintendo / Creatures Inc. / GAME FREAK inc.                                                                  |
| `public/site/`                                                                                        | Website images (backgrounds, towers, town art, sprites, maps)                                         | Pokémon sprites and maps © Nintendo / Creatures Inc. / GAME FREAK inc.; the rest by their respective authors |
| `public/game/fonts/jersey-15.woff2`                                                                   | Jersey 15 font                                                                                        | The Soft Type Project Authors, under the [SIL Open Font License 1.1](public/game/fonts/OFL.txt)              |

The website also loads IBM Plex Sans, IBM Plex Mono, Silkscreen and Pixelify Sans through `next/font/google`. They are under the SIL Open Font License 1.1.

If you own something in this repository and want it removed, open an issue or contact the maintainer, and it will be taken down.
