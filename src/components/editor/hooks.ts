"use client";

import { session } from "@/game/session";
import { useSyncExternalStore } from "react";

/** Re-render when the session changes (open city, mode, account, room…) */
export function useSession() {
  useSyncExternalStore(session.subscribe, () => session.version, () => 0);
  return session;
}

/** Re-render when the editor changes (tools, layers, selection, people, story…) */
export function useEditor() {
  useSession();
  const editor = session.editor;
  useSyncExternalStore(editor?.subscribe ?? noop, () => editor?.version ?? 0, () => 0);
  return editor;
}

const noop = () => () => {};
