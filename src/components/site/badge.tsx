import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/** Badge */
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-fg tabular-nums", className)} {...props} />;
}
