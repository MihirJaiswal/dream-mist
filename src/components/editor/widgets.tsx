"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { X } from "@phosphor-icons/react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";

/** Local draft of a value, reset whenever the value changes from outside (undo, another builder, another selection) */
export function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

/** Shows a canvas or image element made by the engine (tile thumbnails, sprite previews) */
export function CanvasView({ make, deps, className }: { make: () => HTMLElement | null; deps: unknown[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = make();
    ref.current?.replaceChildren(...(element ? [element] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <span ref={ref} className={cn("pixelated inline-flex items-center justify-center [&_canvas]:[image-rendering:pixelated] [&_img]:[image-rendering:pixelated]", className)} />;
}

/** Labeled field (with an optional button beside the label) */
export function Field({ label, hint, action, children, className }: { label: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {action
        ? <div className="flex items-center justify-between gap-2"><Label className="text-xs font-medium text-muted-foreground">{label}</Label>{action}</div>
        : <Label className="text-xs font-medium text-muted-foreground">{label}</Label>}
      {children}
      {hint ? <p className="text-xs text-subtle-fg">{hint}</p> : null}
    </div>
  );
}

/** Number input that commits a clamped value on change */
export function NumberInput({ value, min = 1, max = 100, onCommit, className, ...props }: { value: number; min?: number; max?: number; onCommit: (value: number) => void } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  const [text, setText] = useDraft(`${value}`);
  const commit = () => {
    const next = Math.max(min, Math.min(max, Number(text) || min));
    setText(`${next}`);
    if (next !== value) {
      onCommit(next);
    }
  };
  return <Input type="number" inputMode="numeric" min={min} max={max} value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === "Enter" && commit()} className={cn("h-8 w-16 px-2 tabular-nums", className)} {...props} />;
}

/** Text input that commits on blur or Enter (avoids an undo step per keystroke) */
export function TextInput({ value, onCommit, ...props }: { value: string; onCommit: (value: string) => void } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  const [text, setText] = useDraft(value);
  const commit = () => text !== value && onCommit(text);
  return <Input value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === "Enter" && commit()} {...props} />;
}

/** Icon button with a tooltip (label, optional description and shortcut) */
export function Tip({ label, description, shortcut, side = "top", children }: { label: string; description?: string; shortcut?: string; side?: "top" | "right" | "bottom" | "left"; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-60">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {shortcut ? <kbd className="rounded border border-white/20 px-1 font-mono text-[10px] opacity-80">{shortcut}</kbd> : null}
        </div>
        {description ? <p className="mt-0.5 text-[11px] opacity-75">{description}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Section of the side panel */
export function Pane({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 border-b border-border px-3 py-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-pixel text-[10px] uppercase tracking-wider text-muted-foreground">{title}</h3>
        {hint ? <span className="truncate text-[11px] text-subtle-fg">{hint}</span> : null}
        {action}
      </header>
      {children}
    </section>
  );
}

/** A picker item (upload, favorite) with a small remove button that shows on hover */
export function Removable({ label, onRemove, children }: { label: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <button aria-label={label} title={label} onClick={onRemove} className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full border border-border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"><X size={9} weight="bold" /></button>
    </div>
  );
}

/** Hint paragraph */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{children}</p>;
}
