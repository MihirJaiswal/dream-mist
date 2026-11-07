import type { Card } from "@/lib/api";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** City ids made by short_id() */
export function isGameId(id: string) {
  return /^[a-z0-9]{10}$/.test(id);
}

/** Server-side client with the public key (no session: only what anyone may see) */
function anonymous() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Games shared on Explore, for the sitemap (empty when the server can't be reached) */
export async function publishedGames(): Promise<Card[]> {
  if (!url || !key) {
    return [];
  }
  const { data, error } = await anonymous()
    .rpc("explore")
    .then(
      (result) => result,
      () => ({ data: null, error: true }),
    );
  return error ? [] : ((data as Card[] | null) ?? []);
}

/**
 * A game's card for its page and link preview, looked up on the server (null when it doesn't exist or the server can't be reached).
 * Cached per request, so the page and its metadata share one lookup
 */
export const gameCard = cache(async (id: string): Promise<Card | null> => {
  if (!url || !key || !isGameId(id)) {
    return null;
  }
  const db = anonymous();
  try {
    const { data, error } = await db.rpc("city_card_of", { city_id: id });
    if (!error) {
      return (data as Card | null) ?? null;
    }
    //Before the game pages migration: the full city carries its card too
    const full = await db.rpc("get_city", { city_id: id });
    return ((full.data as { meta?: Card } | null)?.meta as Card | undefined) ?? null;
  } catch {
    return null;
  }
});
