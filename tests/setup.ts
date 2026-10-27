import { readFileSync } from "node:fs";
import { assets } from "@/game/assets";

/** Load the real Pokédex, moves and type chart the game uses (normally fetched when the editor boots) */
Object.assign(assets, JSON.parse(readFileSync("public/game/data/city/pokedex.json", "utf8")));
