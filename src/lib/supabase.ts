import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase project (set in .env.local and in Vercel): newer projects call the browser key "publishable", older ones "anon" */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Is Supabase set up (without it, DreamMist works offline with browser saves) */
export const configured = Boolean(url && key);

/** Name of the cookie (or its first chunk) that holds a session: the server reads it to show the signed-in home */
export const sessionCookie = /^sb-.+-auth-token(\.0)?$/;

let client = null as null | SupabaseClient;

/**
 * Shared browser client. The session lives in cookies, so the server can tell a signed-in visitor apart before the page shows.
 * Sessions saved in local storage before the switch move to the cookies once
 */
export function supabase() {
  if (!configured) {
    throw new Error("Online features aren't set up yet: add the Supabase URL and key to the environment.");
  }
  if (!client) {
    client = createBrowserClient(url, key);
    adopt(client);
  }
  return client;
}

/** Move a session kept in local storage (before sessions moved to cookies) into the client, then forget the old copy */
function adopt(client: SupabaseClient) {
  try {
    const name = Object.keys(localStorage).find((name) => sessionCookie.test(name));
    const saved = name ? JSON.parse(localStorage.getItem(name) ?? "null") : null;
    if (!name) {
      return;
    }
    localStorage.removeItem(name);
    if (saved?.access_token && saved?.refresh_token) {
      //Queued behind the client's auth lock: reading the session waits for it
      void client.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
    }
  } catch {
    //Storage blocked: nothing to move
  }
}
