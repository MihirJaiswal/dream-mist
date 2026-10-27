import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase project (set in .env.local and in Vercel): newer projects call the browser key "publishable", older ones "anon" */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Is Supabase set up (without it, DreamMist works offline with browser saves) */
export const configured = Boolean(url && key);

let client = null as null | SupabaseClient;

/** Shared browser client (keeps the session in local storage and finishes Google sign-in on return) */
export function supabase() {
  if (!configured) {
    throw new Error("Online features aren't set up yet: add the Supabase URL and key to the environment.");
  }
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  return client;
}
