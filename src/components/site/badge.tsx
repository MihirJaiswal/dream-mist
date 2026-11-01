import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/** Small pixel tag (map size, interiors, story) */
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("inline-flex items-center gap-1 bg-[#2a1a52] px-1.5 py-0.5 font-game text-[12px] text-[#c9b8f5] tabular-nums", className)} {...props} />;
}
