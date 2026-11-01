"use client";

import { useEditor } from "@/components/editor/hooks";
import { timeline } from "@/components/editor/story-timeline";
import { CanvasView, Field, Hint, TextInput, Tip } from "@/components/editor/widgets";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { npc as texture, preview } from "@/game/assets";
import type { Quest, Step } from "@/game/data";
import { obstacles } from "@/game/editor/constants";
import type { EditorEngine } from "@/game/editor/engine";
import { lanes, stepLabel } from "@/game/story";
import { ui } from "@/game/ui-bridge";
import { cn } from "@/lib/utils";
import { ArrowCounterClockwise, CaretDown, CaretUp, Flag, Plus, Scroll, TreeStructure, X } from "@phosphor-icons/react";

/** Story timeline: the main story and side quests, each a chain of steps, and what blocks the way until each is done */
export function StoryPanel() {
  const editor = useEditor();
  const city = editor.city;
  const [main, ...sides] = lanes(city);
  return (
    <div className="grid grid-cols-1 gap-3">
      <Hint>
        The main story and each side quest are chains of steps. Pick a step and paint gates on the map: those tiles stay blocked until it&apos;s done. Choose
        who completes each step in a person&apos;s Story settings.
      </Hint>
      <Button variant="secondary" size="sm" onClick={() => timeline(editor)}>
        <TreeStructure />
        Open the timeline
      </Button>
      <section className="grid gap-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-fg">
          <Flag size={12} />
          Main story
        </p>
        <Steps editor={editor} steps={main.steps} empty="No story yet. Add the first step, like “Meet the Professor”." />
        <Button variant="outline" size="sm" onClick={() => editor.addStep()}>
          <Plus />
          Add step
        </Button>
      </section>
      {sides.map(({ quest, steps }) => (
        <QuestLane key={quest!.id} editor={editor} quest={quest!} steps={steps} />
      ))}
      <Button variant="outline" size="sm" onClick={() => editor.addQuest()}>
        <Scroll />
        New side quest
      </Button>
      <Button variant="ghost" size="sm" title="Forget your own progress so you can test the story again" onClick={() => editor.restart()}>
        <ArrowCounterClockwise />
        Restart my progress
      </Button>
    </div>
  );
}

/** A side quest: its name, when it starts, and its steps */
function QuestLane({ editor, quest, steps }: { editor: EditorEngine; quest: Quest; steps: Step[] }) {
  const city = editor.city;
  const before = city.story.filter((step) => step.quest !== quest.id);
  return (
    <section className="grid gap-1.5 rounded-lg border border-border p-2">
      <div className="flex items-center gap-1">
        <Scroll size={14} className="shrink-0 text-select" />
        <TextInput
          aria-label="Side quest name"
          value={quest.name}
          maxLength={40}
          onCommit={(name) => editor.mutate(() => (quest.name = name.trim() || "Side quest"))}
          className="h-7 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:border-input"
        />
        <button
          aria-label="Delete side quest"
          title="Delete side quest"
          onClick={async () =>
            (await ui.confirm(`Delete “${quest.name}”?`, {
              text: `Its ${steps.length === 1 ? "step" : `${steps.length} steps`} go too: their gates open and people stop using them.`,
              action: "Delete",
              danger: true,
            })) && editor.deleteQuest(quest.id)
          }
          className="grid size-6 shrink-0 place-items-center rounded text-subtle-fg hover:text-destructive"
        >
          <X size={13} />
        </button>
      </div>
      <Field label="Starts">
        <Select value={quest.after ?? "now"} onValueChange={(value) => editor.mutate(() => (value === "now" ? delete quest.after : (quest.after = value)))}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="now">Right away</SelectItem>
            {before.map((step) => (
              <SelectItem key={step.id} value={step.id}>
                After {stepLabel(city, step)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Hint>It shows in the player&apos;s Journal once its first step is done, and stays secret until then.</Hint>
      <Steps editor={editor} steps={steps} empty="No steps yet." />
      <Button variant="outline" size="sm" onClick={() => editor.addStep(quest.id)}>
        <Plus />
        Add step
      </Button>
    </section>
  );
}

/** Steps of one lane, in order */
function Steps({ editor, steps, empty }: { editor: EditorEngine; steps: Step[]; empty: string }) {
  const current = editor.currentStep;
  if (!steps.length) {
    return <p className="py-1 text-center text-xs text-subtle-fg">{empty}</p>;
  }
  return (
    <ol className="relative grid gap-1.5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
      {steps.map((step, i) => {
        const active = step.n === current;
        const by = editor.people("completes", step.id),
          shows = editor.people("after", step.id),
          hides = editor.people("until", step.id),
          count = editor.gates(step.n);
        return (
          <li
            key={step.id}
            onClick={(event) => !(event.target as HTMLElement).closest("input, button, textarea, [role=combobox]") && editor.setStep(step.n)}
            className={cn("relative flex gap-2 rounded-lg border p-2", active ? "border-select bg-card" : "border-transparent hover:bg-muted/50")}
          >
            <span
              className={cn(
                "z-10 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]",
                active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-0.5">
                <TextInput
                  aria-label="Step name"
                  value={step.name}
                  maxLength={40}
                  onCommit={(name) => editor.mutate(() => (step.name = name.trim() || "Untitled step"))}
                  className="h-7 border-transparent bg-transparent px-1 text-sm font-medium shadow-none focus-visible:border-input"
                />
                <button
                  aria-label="Move earlier"
                  title="Move earlier"
                  disabled={i === 0}
                  onClick={() => editor.moveStep(step.id, -1)}
                  className="grid size-6 place-items-center rounded text-subtle-fg hover:text-foreground disabled:opacity-30"
                >
                  <CaretUp size={13} />
                </button>
                <button
                  aria-label="Move later"
                  title="Move later"
                  disabled={i === steps.length - 1}
                  onClick={() => editor.moveStep(step.id, 1)}
                  className="grid size-6 place-items-center rounded text-subtle-fg hover:text-foreground disabled:opacity-30"
                >
                  <CaretDown size={13} />
                </button>
                <button
                  aria-label="Delete step"
                  title="Delete step"
                  onClick={async () =>
                    (await ui.confirm(`Delete “${step.name}”?`, { text: "Its gates open and people stop using this step.", action: "Delete", danger: true })) &&
                    editor.deleteStep(step.id)
                  }
                  className="grid size-6 place-items-center rounded text-subtle-fg hover:text-destructive"
                >
                  <X size={13} />
                </button>
              </div>
              <p className="px-1 text-[11px] text-subtle-fg">
                {[
                  by.length ? `Done by ${by.join(", ")}` : "Nobody completes it yet",
                  count ? `${count} gate tile${count > 1 ? "s" : ""}` : "",
                  shows.length ? `shows ${shows.join(", ")}` : "",
                  hides.length ? `hides ${hides.join(", ")}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {active ? (
                <div className="mt-2 grid gap-2 px-1">
                  <Field label="Journal says">
                    <TextInput
                      value={step.goal ?? ""}
                      placeholder={step.name}
                      maxLength={80}
                      onCommit={(text) => editor.mutate(() => (text.trim() ? (step.goal = text.trim()) : delete step.goal))}
                      className="h-8"
                    />
                  </Field>
                </div>
              ) : null}
              {active ? <Blocker editor={editor} step={step} /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** What blocks the way until a step is done: an invisible wall, an object, or people */
function Blocker({ editor, step }: { editor: EditorEngine; step: Step }) {
  const kind = step.blocker ?? "wall";
  const kinds = [
    ["wall", "Wall", "An invisible wall with a message"],
    ["object", "Object", "A rock, tree, fence… drawn on the gates"],
    ["person", "Person", "Someone standing in the way"],
  ] as const;
  const brush = editor.stamp.tiles.find(Boolean);
  const message = (
    <Field label={kind === "object" ? "Message when bumping into it" : "Message at its gates"}>
      <TextInput value={step.blocked} placeholder="The path is blocked…" onCommit={(text) => editor.mutate(() => (step.blocked = text))} className="h-8" />
    </Field>
  );
  return (
    <div className="mt-2 grid gap-2 px-1">
      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Blocked by">
        {kinds.map(([value, label, title]) => (
          <button
            key={value}
            role="radio"
            aria-checked={kind === value}
            title={title}
            onClick={() => editor.setBlocker(step, value)}
            className={cn("h-7 rounded text-xs", kind === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "wall" ? (
        <>
          <Hint>Paint gate tiles on the map. They look normal but can&apos;t be crossed until this step is done.</Hint>
          {message}
        </>
      ) : null}
      {kind === "object" ? (
        <>
          <Hint>Pick what stands in the way, then paint gate tiles where it should be. It disappears when this step is done.</Hint>
          <div className="grid grid-cols-4 gap-1">
            {[
              ...obstacles.map(({ name, tile, message }) => ({ name, tile, message })),
              ...(brush ? [{ name: "Your brush", tile: brush, message: "" }] : []),
            ].map(({ name, tile, message }) => (
              <button
                key={name}
                title={name}
                onClick={() => editor.setObstacle(step, tile, message)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border bg-card p-1",
                  step.tile === tile ? "border-select" : "border-border hover:border-ring",
                )}
              >
                <CanvasView className="size-8" make={() => editor.stampCanvas({ w: 1, h: 1, tiles: [tile] }, 2)} deps={[tile]} />
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">{name}</span>
              </button>
            ))}
          </div>
          {message}
        </>
      ) : null}
      {kind === "person" ? <BlockingPeople editor={editor} step={step} /> : null}
    </div>
  );
}

/** People standing in the way until a step is done */
function BlockingPeople({ editor, step }: { editor: EditorEngine; step: Step }) {
  const npcs = editor.city.npcs.map((npc, index) => ({ npc, index }));
  const blocking = npcs.filter(({ npc }) => npc.story?.until === step.id);
  const others = npcs.filter(({ npc }) => npc.story?.until !== step.id && (npc.sprite || npc.creature));
  const placing = editor.blocking === step.id;
  return (
    <div className="grid grid-cols-1 gap-2">
      <Hint>Someone stands on the path and walks away once this step is done. They block where they stand, so no gates are needed.</Hint>
      {blocking.map(({ npc, index }) => (
        <div key={index} className="flex items-center gap-2 rounded-md border border-border bg-card p-1.5">
          <CanvasView className="h-8 w-6" make={() => preview(texture(npc.sprite || "hiker", "down"), 1)} deps={[npc.sprite]} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-xs">{npc.name || "Someone"}</b>
            <small className="text-[11px] text-subtle-fg">
              stands at {npc.x}, {npc.y}
            </small>
          </div>
          <Button variant="ghost" size="sm" className="h-7" title="Edit looks and dialogue" onClick={() => editor.editNpc(index)}>
            Edit
          </Button>
          <Tip label="Stop blocking for this step">
            <button
              aria-label="Stop blocking for this step"
              onClick={() => editor.unblock(index)}
              className="grid size-7 place-items-center rounded text-subtle-fg hover:text-destructive"
            >
              <X size={13} />
            </button>
          </Tip>
        </div>
      ))}
      <Button variant={placing ? "outline" : "secondary"} size="sm" onClick={() => (placing ? editor.stopBlocking() : editor.startBlocking(step.id))}>
        {placing ? (
          <>
            <X />
            Cancel placing
          </>
        ) : (
          <>
            <Plus />
            {blocking.length ? "Place another person" : "Place a person in the way"}
          </>
        )}
      </Button>
      {others.length ? (
        <Select value="" onValueChange={(value) => editor.blockWith(Number(value), step.id)}>
          <SelectTrigger className="h-8" aria-label="Use someone already on the map">
            <SelectValue placeholder="Or choose someone already here…" />
          </SelectTrigger>
          <SelectContent>
            {others.map(({ npc, index }) => (
              <SelectItem key={index} value={`${index}`}>
                {npc.name || "Someone"} ({npc.x}, {npc.y})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
