"use client";

import { useEditor } from "@/components/editor/hooks";
import { toolIcons } from "@/components/editor/icons";
import { Tip } from "@/components/editor/widgets";
import { placing, tools } from "@/game/editor/constants";
import { cn } from "@/lib/utils";
import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react";

const mod = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘" : "Ctrl+";

/** Vertical tool rail: painting tools, then undo and redo */
export function ToolRail() {
  const editor = useEditor();
  if (!editor) {
    return null;
  }
  const button =
    "grid size-9 pointer-coarse:size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35";
  return (
    <nav aria-label="Tools" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r pointer-coarse:w-14 border-border bg-card py-2">
      {tools.map(({ key, label, shortcut, tip }) => {
        const Icon = toolIcons[key];
        const disabled = placing.includes(editor.target) && key !== "brush" && key !== "select";
        return (
          <Tip key={key} label={label} shortcut={shortcut} description={tip} side="right">
            <button
              aria-label={label}
              aria-pressed={editor.tool === key}
              disabled={disabled}
              onClick={() => editor.setTool(key)}
              className={cn(button, editor.tool === key && "bg-muted text-foreground ring-1 ring-border")}
            >
              <Icon size={18} weight={editor.tool === key ? "fill" : "regular"} />
            </button>
          </Tip>
        );
      })}
      <span className="flex-1" />
      <Tip label="Undo" shortcut={`${mod}Z`} description="Revert your last change" side="right">
        <button aria-label="Undo" disabled={!editor.canUndo} onClick={() => editor.undo()} className={button}>
          <ArrowCounterClockwise size={18} />
        </button>
      </Tip>
      <Tip label="Redo" shortcut={`${mod}⇧Z`} description="Bring back what you undid" side="right">
        <button aria-label="Redo" disabled={!editor.canRedo} onClick={() => editor.redo()} className={button}>
          <ArrowClockwise size={18} />
        </button>
      </Tip>
    </nav>
  );
}
