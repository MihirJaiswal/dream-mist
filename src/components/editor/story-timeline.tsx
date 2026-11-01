"use client";

import { openDialog } from "@/components/editor/dialogs";
import { useEditor } from "@/components/editor/hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { species } from "@/game/assets";
import type { Step } from "@/game/data";
import type { EditorEngine } from "@/game/editor/engine";
import { problems } from "@/game/problems";
import { goal, lanes, stepLabel } from "@/game/story";
import { cn } from "@/lib/utils";
import { Flag, Plus, Scroll, Warning } from "@phosphor-icons/react";

/** Open the story timeline: every lane side by side, with who moves each step forward */
export function timeline(editor: EditorEngine) {
  return openDialog<void>((close) => <Timeline close={close} initial={editor} />);
}

function Timeline({ close, initial }: { close: () => void; initial: EditorEngine }) {
  const editor = useEditor() ?? initial;
  const world = editor.world;
  const broken = new Map(problems(world, (id) => Boolean(species(id))).filter(({ layer, step }) => (layer === "story") && (step)).map(({ step, text }) => [step!, text]));
  const pick = (step: Step) => {
    close();
    editor.select("story");
    editor.setStep(step.n);
  };
  const add = (quest = "") => {
    editor.addStep(quest);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Story timeline</DialogTitle>
          <DialogDescription>The main story and side quests, step by step. Click a step to paint its gates or change it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {lanes(world).map(({ quest, steps }) => {
            const after = quest?.after ? world.story.find(({ id }) => id === quest.after) : null;
            return (
              <section key={quest?.id ?? "main"} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[11rem_minmax(0,1fr)]">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">{quest ? <Scroll size={15} className="shrink-0 text-select" /> : <Flag size={15} className="shrink-0" />}<span className="truncate">{quest?.name ?? "Main story"}</span></p>
                  <p className="text-xs text-subtle-fg">{quest ? after ? `Starts after ${stepLabel(world, after)}` : "Starts right away" : `${steps.length} step${steps.length === 1 ? "" : "s"}`}</p>
                </div>
                <div className="overflow-x-auto pb-1">
                  <ol className="flex w-max items-stretch gap-0">
                    {steps.map((step, i) => {
                      const by = editor.people("completes", step.id);
                      const unlocks = world.quests.filter(({ after }) => after === step.id);
                      const problem = broken.get(step.n);
                      const gates = editor.gates(step.n);
                      return (
                        <li key={step.id} className="flex items-center">
                          {i ? <span aria-hidden className="h-px w-4 bg-border" /> : null}
                          <button onClick={() => pick(step)} title={problem} className={cn("grid h-full w-44 content-start gap-1 rounded-md border bg-card p-2 text-left hover:border-ring", problem ? "border-destructive/60" : "border-border")}>
                            <span className="flex items-center gap-1.5"><span className="grid size-5 shrink-0 place-items-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">{i + 1}</span><b className="truncate text-xs">{step.name}</b></span>
                            {step.goal ? <span className="line-clamp-2 text-[11px] italic text-muted-foreground">“{goal(step)}”</span> : null}
                            <span className={cn("text-[11px]", by.length ? "text-subtle-fg" : "text-destructive")}>{by.length ? `Done by ${by.join(", ")}` : <span className="inline-flex items-center gap-1"><Warning size={11} />Nobody completes it</span>}</span>
                            {gates ? <span className="text-[11px] text-subtle-fg">{gates} gate tile{gates > 1 ? "s" : ""}</span> : null}
                            {unlocks.map((quest) => <span key={quest.id} className="inline-flex w-fit items-center gap-1 rounded bg-select/15 px-1.5 py-0.5 text-[10px] text-select"><Scroll size={10} />Starts {quest.name}</span>)}
                          </button>
                        </li>
                      );
                    })}
                    <li className="flex items-center">
                      {steps.length ? <span aria-hidden className="h-px w-4 bg-border" /> : null}
                      <Button variant="ghost" size="sm" className="h-full min-h-14 border border-dashed border-border" onClick={() => add(quest?.id)}><Plus />Step</Button>
                    </li>
                  </ol>
                </div>
              </section>
            );
          })}
          <Button variant="outline" size="sm" className="w-fit" onClick={() => editor.addQuest()}><Scroll />New side quest</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
