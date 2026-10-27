"use client";

import { openDialog } from "@/components/editor/dialogs";
import { CanvasView, useDraft } from "@/components/editor/widgets";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assets, portrait, species } from "@/game/assets";
import { colors } from "@/game/battle";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** Generations (national dex ranges) */
const generations = [
  { label: "I", region: "Kanto", from: 1, to: 151 },
  { label: "II", region: "Johto", from: 152, to: 251 },
  { label: "III", region: "Hoenn", from: 252, to: 386 },
  { label: "IV", region: "Sinnoh", from: 387, to: 493 },
  { label: "V", region: "Unova", from: 494, to: 649 },
  { label: "VI", region: "Kalos", from: 650, to: 721 },
  { label: "VII", region: "Alola", from: 722, to: 809 },
  { label: "VIII", region: "Galar", from: 810, to: 905 },
  { label: "IX", region: "Paldea", from: 906, to: 1025 },
];

/** Cards rendered per batch (more load while scrolling) */
const batch = 90;

/** Type badge */
export function TypeBadge({ type }: { type: string }) {
  const color = colors[type] ?? "#888";
  return <span className="rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color: `color-mix(in srgb, ${color} 70%, white)` }}>{type}</span>;
}

/** Search and browse every Pokémon, resolves with the chosen id (undefined when closed) */
export function pickSpecies(current = 0) {
  return openDialog<number>((close) => <PokemonPicker current={current} close={close} />);
}

function PokemonPicker({ current, close }: { current: number; close: (id?: number) => void }) {
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState(-1);
  const [type, setType] = useState("all");
  const [shown, setShown] = useState(batch);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const text = query.trim().toLowerCase().replace(/^#/, "");
    const number = /^\d+$/.test(text);
    const range = generations[generation];
    return assets.pokedex.filter(({ id, name, key, types }) =>
      ((!range) || ((id >= range.from) && (id <= range.to))) &&
      ((type === "all") || (types.includes(type))) &&
      ((!text) || (number ? `${id}`.startsWith(text) : (name.toLowerCase().includes(text)) || (key.includes(text))))
    );
  }, [query, generation, type]);

  //Start from the top on new filters, but show the current Pokémon when opening
  const [shownFor, setShownFor] = useState<typeof results | null>(null);
  if (shownFor !== results) {
    const index = results.findIndex(({ id }) => id === current);
    setShownFor(results);
    setShown((query || (generation >= 0) || (type !== "all") || (index < 0)) ? batch : Math.ceil((index + 1) / batch) * batch);
  }
  useEffect(() => scroller.current?.scrollTo({ top: 0 }), [results]);
  useEffect(() => {
    requestAnimationFrame(() => scroller.current?.querySelector("[data-current]")?.scrollIntoView({ block: "center" }));
  }, []);

  //Load more while scrolling
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.some(({ isIntersecting }) => isIntersecting) && setShown((count) => count + batch), { root: scroller.current, rootMargin: "200px" });
    if (sentinel.current) {
      observer.observe(sentinel.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex h-[min(720px,88vh)] max-w-3xl flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a Pokémon</DialogTitle>
          <DialogDescription className="sr-only">Search every Pokémon by name, number, type or generation.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input autoFocus type="search" placeholder="Search by name or number…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && results[0] && close(results[0].id)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-40" aria-label="Type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.keys(colors).map((name) => <SelectItem key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Generation">
          {[{ label: "All", region: "Every generation" }, ...generations].map(({ label, region }, i) => (
            <button key={label} role="radio" aria-checked={generation === i - 1} title={i ? `Generation ${label} · ${region}` : region} onClick={() => setGeneration(i - 1)} className={cn("h-7 min-w-9 rounded-full border px-2.5 font-mono text-xs transition-colors", generation === i - 1 ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-ring hover:text-foreground")}>{label}</button>
          ))}
        </div>
        <div ref={scroller} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1" role="listbox" aria-label="Pokémon">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
            {results.slice(0, shown).map(({ id, name, types }) => (
              <button key={id} role="option" aria-selected={id === current} data-current={id === current ? "" : undefined} onClick={() => close(id)} className={cn("flex min-w-0 flex-col items-center gap-0.5 rounded-lg border bg-card px-1.5 pb-2.5 pt-2 text-center transition-colors hover:border-ring hover:bg-muted", id === current ? "border-select ring-1 ring-select" : "border-border")}>
                <CanvasView className="h-[84px]" make={() => portrait(id, 1.5)} deps={[id]} />
                <span className="font-mono text-[10px] text-subtle-fg">#{`${id}`.padStart(4, "0")}</span>
                <b className="max-w-full truncate text-xs font-semibold">{name}</b>
                <span className="flex flex-wrap justify-center gap-1">{types.map((type) => <TypeBadge key={type} type={type} />)}</span>
              </button>
            ))}
            {!results.length ? <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No Pokémon match. Try another name, type or generation.</p> : null}
          </div>
          <div ref={sentinel} className="h-px" />
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-xs text-subtle-fg">
          <span>{results.length} Pokémon</span>
          <span>Enter picks the first result</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Pokémon field: its picture opens the picker, or type a name or number */
export function SpeciesInput({ value, onChange, className }: { value: number; onChange: (id: number) => void; className?: string }) {
  const known = species(value);
  const [text, setText] = useDraft(known ? `${known.name} #${value}` : "");
  const commit = () => {
    const input = text.trim().toLowerCase();
    const match = input.match(/#?(\d+)$/);
    const id = match ? Number(match[1]) : assets.pokedex.find(({ name, key }) => (name.toLowerCase() === input) || (key === input))?.id;
    if ((id) && (species(id))) {
      setText(`${species(id).name} #${id}`);
      if (id !== value) {
        onChange(id);
      }
    } else if (input) {
      toast.error("Unknown Pokémon");
      setText(known ? `${known.name} #${value}` : "");
    }
  };
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1", className)}>
      <button type="button" title="Browse Pokémon" aria-label="Browse Pokémon" onClick={async () => {
        const id = await pickSpecies(known ? value : 0);
        if ((id) && (species(id))) {
          onChange(id);
        }
      }} className="grid h-8 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted hover:border-ring hover:bg-input">
        {known ? <CanvasView className="[&>*]:max-h-7 [&>*]:max-w-8" make={() => portrait(value, 1)} deps={[value]} /> : null}
      </button>
      <Input value={text} placeholder="Pokémon…" onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === "Enter" && commit()} className="h-8 min-w-0" />
    </div>
  );
}
