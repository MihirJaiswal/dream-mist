"use client";

import { openDialog } from "@/components/editor/dialogs";
import { journalDialog, townMap, wildDialog } from "@/components/editor/trainer-dialogs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { session } from "@/game/session";
import { useEffect } from "react";
import { toast } from "sonner";

/** Every editor shortcut, by group (the cheat sheet shows this list) */
export const shortcuts = [
  {
    group: "Anywhere",
    keys: [
      ["⌘ K", "Search actions, tools, stamps, maps and people"],
      ["⌘ F", "Same as ⌘ K"],
      ["⌘ S", "Save now"],
      ["⌘ Enter", "Switch between Build and Play"],
      ["⌘ \\", "Hide or show the panels"],
      ["?", "This list"],
    ],
  },
  {
    group: "Tools",
    keys: [
      ["B", "Brush"],
      ["E", "Eraser"],
      ["X", "Swap brush and eraser"],
      ["R", "Rectangle"],
      ["F", "Fill"],
      ["I", "Picker"],
      ["S", "Select"],
      ["Alt + click", "Pick the tile under the cursor as the brush"],
    ],
  },
  {
    group: "Painting",
    keys: [
      ["Shift + drag", "Paint a straight line"],
      ["Shift + erase", "Erase every layer of the square"],
      ["1 to 9", "Pick a layer"],
    ],
  },
  {
    group: "Selection",
    keys: [
      ["⌘ A", "Select the whole map"],
      ["⌘ C / ⌘ X / ⌘ V", "Copy, cut, paste"],
      ["⌘ D", "Duplicate the selection next to it"],
      ["Arrow keys", "Move the selection (Shift: 5 tiles)"],
      ["Delete", "Clear the selection, or remove the selected person"],
      ["Esc", "Stop selecting, pasting or placing"],
    ],
  },
  {
    group: "Overlapping pieces",
    keys: [
      ["]", "Bring the piece behind to the front (under the cursor)"],
      ["[", "Send the front piece back"],
    ],
  },
  {
    group: "View",
    keys: [
      ["+ / −", "Zoom in, zoom out"],
      ["⇧ 1", "Fit the whole map"],
      ["⇧ 2", "Zoom to the selection"],
      ["0", "Fit the map"],
      ["G", "Show or hide the grid"],
      ["Space + drag", "Pan"],
    ],
  },
  {
    group: "Testing",
    keys: [
      ["P", "Play from the tile under the cursor"],
      ["⌘ Z / ⇧ ⌘ Z", "Undo, redo"],
    ],
  },
  {
    group: "Play mode",
    keys: [
      ["WASD, arrow keys", "Walk (Shift runs)"],
      ["Space, Z, E", "Talk, read, continue"],
      ["Enter", "Open the menu (Pokédex, Pokémon, Bag…)"],
      ["X, Esc", "Go back (menus, battles)"],
      ["J", "Open the Journal"],
      ["N", "See the wild Pokémon living on this map"],
      ["M", "Open the Town Map"],
      ["V", "Use the VS Seeker (trainers you beat want a rematch)"],
      ["1 to 4", "Pick a battle option"],
    ],
  },
] as const;

/** Shortcut cheat sheet (?) */
export function shortcutsSheet() {
  return openDialog<void>((close) => (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>⌘ is Ctrl on Windows and Linux. Press ? anytime to see this list.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {shortcuts.map(({ group, keys }) => (
            <section key={group}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">{group}</h3>
              <dl className="grid gap-1">
                {keys.map(([key, action]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{action}</dt>
                    <dd className="shrink-0">
                      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{key}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  ));
}

/** Open command search (shared with the top bar button) */
export function openSearch() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
}

/** App-wide shortcuts: save, Build/Play, search, hide panels and the cheat sheet */
export function useAppShortcuts({ onPanels }: { onPanels: () => void }) {
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const typing = (event.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]");
      if (command && key === "s") {
        //Never the browser's "Save page" window
        event.preventDefault();
        void session.persist().then(() => toast.success(session.saved || "Saved"));
        return;
      }
      if (command && key === "enter" && session.ready) {
        event.preventDefault();
        void session.setMode(session.mode === "edit" ? "play" : "edit");
        return;
      }
      if (command && key === "f") {
        event.preventDefault();
        return openSearch();
      }
      if (command && event.key === "\\") {
        event.preventDefault();
        return onPanels();
      }
      if (key === "j" && !typing && !command && session.ready && session.mode === "play" && !document.querySelector("[role=dialog], [role=alertdialog]")) {
        event.preventDefault();
        void journalDialog();
        return;
      }
      if (key === "m" && !typing && !command && session.ready && session.mode === "play" && !document.querySelector("[role=dialog], [role=alertdialog]")) {
        event.preventDefault();
        void townMap();
        return;
      }
      if (key === "n" && !typing && !command && session.ready && session.mode === "play" && !document.querySelector("[role=dialog], [role=alertdialog]")) {
        event.preventDefault();
        void wildDialog();
        return;
      }
      if (event.key === "?" && !typing && !command && !document.querySelector("[role=dialog], [role=alertdialog]")) {
        event.preventDefault();
        void shortcutsSheet();
      }
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [onPanels]);
}
