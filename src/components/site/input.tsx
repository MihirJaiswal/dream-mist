import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/** Input */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-fg placeholder:text-subtle-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...props} />;
}
