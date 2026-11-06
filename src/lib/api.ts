/**
 * Website data on Supabase: the signed-in user, published cities and likes.
 */
import { configured, supabase } from "@/lib/supabase";

/** Editor url */
export function edit(hash = "") {
  return `/editor${hash ? `#${hash}` : ""}`;
}

/** Published city card */
export type Card = {
  id: string;
  name: string;
  owner: string;
  author: string;
  description: string;
  thumb: string;
  width: number;
  height: number;
  interiors: number;
  story: number;
  publishedAt: number;
  updated: number;
  forkOf?: null | { id: string; name: string; owner: string };
  plays: number;
  forks: number;
  likes: number;
  mine?: boolean;
  liked?: boolean;
};

/** Where a login comes back to: the page it started on (Supabase's redirect URLs allow every page of the site) */
function back() {
  return `${location.origin}${location.pathname}${location.search}`;
}

/** Continue with Google: leaves the page, Google and Supabase bring the player back to it signed in */
export async function loginWithGoogle() {
  const { error } = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: back() } });
  if (error) {
    throw error;
  }
}

/** Email a sign-in link (new addresses get an account): the link brings the player back to this page signed in */
export async function loginWithEmail(email: string) {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: back() } });
  if (error) {
    throw error;
  }
}

/** Current user (null when logged out, undefined when online features aren't set up or unreachable) */
export async function me() {
  if (!configured) {
    return undefined;
  }
  try {
    const { data } = await supabase().auth.getSession();
    const id = data.session?.user.id;
    if (!id) {
      return null;
    }
    const { data: profile } = await supabase().from("profiles").select("username").eq("id", id).maybeSingle();
    return profile ? { username: profile.username as string } : null;
  } catch {
    return undefined;
  }
}

/** Published cities */
export async function explore() {
  if (!configured) {
    throw new Error("Explore isn't set up yet: add the Supabase URL and key to the environment.");
  }
  const { data, error } = await supabase().rpc("explore");
  if (error) {
    throw new Error(error.message);
  }
  return data as Card[];
}

/** Like or unlike a city */
export async function like(id: string) {
  const { data, error } = await supabase().rpc("toggle_like", { city_id: id });
  if (error) {
    throw new Error(error.message);
  }
  return data as { liked: boolean; likes: number };
}
