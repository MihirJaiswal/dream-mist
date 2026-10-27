import { cn } from "@/lib/utils";
import Link from "next/link";

type Choice = { label: string; href: string; hint: string };

/** Battle command menu ("What will you do?") used for the main calls to action */
export function BattleMenu({ prompt, choices, className }: { prompt: string; choices: Choice[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-stretch", className)}>
      <div className="dialogue flex items-center px-5 py-4 text-[19px] leading-snug sm:max-w-[13em]">{prompt}</div>
      <nav aria-label="Get started" className="battle-menu grid flex-1 grid-cols-2 gap-x-4 gap-y-1 px-5 py-3">
        {choices.map(({ label, href, hint }, i) => {
          const props = { className: "flex flex-col py-1.5 leading-tight", "data-default": i === 0 ? "" : undefined };
          const content = (
            <>
              <span className="text-[19px] font-bold uppercase">{label}</span>
              <span className="font-sans text-[12px] text-[#6a6a80]">{hint}</span>
            </>
          );
          //The editor loads fresh so its game engine starts clean
          return href.startsWith("/editor") || href.startsWith("http")
            ? <a key={label} href={href} {...props}>{content}</a>
            : <Link key={label} href={href} {...props}>{content}</Link>;
        })}
      </nav>
    </div>
  );
}
