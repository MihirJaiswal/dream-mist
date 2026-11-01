import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/** Pixel text field on the night sky */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("stepped h-11 w-full bg-[#1d1038] px-4 font-game text-[15px] text-white shadow-[inset_0_0_0_3px_#3f2c74] placeholder:text-[#8a7bb8] focus-visible:shadow-[inset_0_0_0_3px_#f06aa6] focus-visible:outline-none", className)} {...props} />;
}
