"use client";

import { useEditor } from "@/components/editor/hooks";
import { ScriptEditor, StepSelect } from "@/components/editor/script-editor";
import { Field, Hint, NumberInput, TextInput, Tip } from "@/components/editor/widgets";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { behaviors } from "@/game/behaviors";
import { cn } from "@/lib/utils";
import { CaretLeft, FilmSlate, Prohibit, Trash } from "@phosphor-icons/react";

/** Collision layer: blocked tiles, or a tile behavior to paint */
export function CollisionPanel({ children }: { children?: React.ReactNode }) {
  const editor = useEditor();
  const brushes = [{ value: 0, label: "Blocked", hint: "Visitors can't walk here, like walls, water edges and trees" }, ...behaviors];
  const current = brushes.find(({ value }) => value === editor.collision) ?? brushes[0];
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Collision brush">
        {brushes.map(({ value, label, hint }) => (
          <button
            key={value}
            role="radio"
            aria-checked={editor.collision === value}
            title={hint}
            onClick={() => editor.setCollision(value)}
            className={cn(
              "flex h-8 items-center justify-center gap-1 rounded-md border px-1 text-xs font-medium",
              editor.collision === value
                ? "border-foreground bg-muted text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-ring hover:text-foreground",
            )}
          >
            {value === 0 ? <Prohibit size={13} className="text-destructive" /> : null}
            {label}
          </button>
        ))}
      </div>
      <Hint>
        {current.hint}. The eraser clears both blocked tiles and behaviors.
        {editor.collision === 0 ? " Objects painted on the Objects layer block automatically." : ""}
      </Hint>
      {children}
    </div>
  );
}

/** Events layer: areas that play a script when the player steps in */
export function EventsPanel() {
  const editor = useEditor();
  const triggers = editor.city.triggers;
  const trigger = triggers[editor.trigger];
  if (!trigger) {
    return (
      <div className="grid grid-cols-1 gap-2">
        <Hint>
          Drag over the map to draw an event area. When the player steps in, its script plays like a cutscene: a rival runs up, someone stops you, a gift is
          handed over. Drag an area to move it.
        </Hint>
        {triggers.length ? (
          <ul className="grid gap-0.5">
            {triggers.map((trigger, i) => (
              <li key={trigger.id}>
                <button
                  onClick={() => editor.selectTrigger(i)}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <FilmSlate size={15} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{trigger.name || "Event"}</span>
                  <span className={cn("text-[11px]", trigger.actions.length ? "text-subtle-fg" : "text-destructive")}>
                    {trigger.actions.length ? `${trigger.actions.length} action${trigger.actions.length > 1 ? "s" : ""}` : "empty"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-center text-xs text-subtle-fg">No events on this map yet.</p>
        )}
      </div>
    );
  }
  const update = (fn: () => void) => editor.mutate(fn);
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center gap-2">
        <Tip label="Back to every event on this map">
          <button
            aria-label="Back"
            onClick={() => editor.selectTrigger(-1)}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CaretLeft size={14} />
          </button>
        </Tip>
        <FilmSlate size={18} className="shrink-0 text-select" />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-sm">{trigger.name || "Event"}</b>
          <small className="text-[11px] text-subtle-fg">
            {trigger.w}×{trigger.h} at {trigger.x}, {trigger.y}
          </small>
        </div>
        <Tip label="Remove this event">
          <button
            aria-label="Remove"
            onClick={() => editor.deleteTrigger()}
            className="grid size-7 place-items-center rounded-md text-subtle-fg hover:text-destructive"
          >
            <Trash size={15} />
          </button>
        </Tip>
      </div>
      <Field label="Name">
        <TextInput value={trigger.name} maxLength={40} onCommit={(name) => update(() => (trigger.name = name))} className="h-8" />
      </Field>
      <div className="grid grid-cols-4 gap-1.5">
        {(["x", "y", "w", "h"] as const).map((key) => (
          <Field key={key} label={{ x: "X", y: "Y", w: "Width", h: "Height" }[key]}>
            <NumberInput
              min={key === "w" || key === "h" ? 1 : 0}
              max={999}
              value={trigger[key]}
              onCommit={(value) => editor.frameTrigger({ [key]: value })}
              className="w-full"
            />
          </Field>
        ))}
      </div>
      <Label className="flex items-center justify-between gap-2 text-xs font-normal text-muted-foreground">
        Plays only the first time
        <Switch checked={trigger.once} onCheckedChange={(once) => update(() => (trigger.once = once))} />
      </Label>
      {editor.world.story.length ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Starts after">
            <StepSelect
              editor={editor}
              value={trigger.after}
              empty="From the start"
              onChange={(id) => update(() => (id ? (trigger.after = id) : delete trigger.after))}
            />
          </Field>
          <Field label="Stops after">
            <StepSelect
              editor={editor}
              value={trigger.until}
              empty="Never"
              onChange={(id) => update(() => (id ? (trigger.until = id) : delete trigger.until))}
            />
          </Field>
        </div>
      ) : null}
      <div className="grid gap-1.5 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">Script</p>
        <ScriptEditor editor={editor} actions={trigger.actions} update={update} />
      </div>
    </div>
  );
}
