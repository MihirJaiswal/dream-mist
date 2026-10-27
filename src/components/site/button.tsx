import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ComponentProps } from "react";

/** Button styles (shadcn/ui-like) */
const variants = {
  primary: "bg-fg text-bg hover:bg-fg/85",
  secondary: "bg-muted text-fg border border-line hover:bg-line",
  outline: "border border-line bg-bg text-fg hover:bg-muted",
  ghost: "text-muted-fg hover:bg-muted hover:text-fg",
} as const;
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-[15px]" } as const;

type Style = { variant?: keyof typeof variants; size?: keyof typeof sizes };

/** Shared classes */
export function buttonClass({ variant = "primary", size = "md" }: Style = {}, extra = "") {
  return cn("inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none", variants[variant], sizes[size], extra);
}

/** Button */
export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & Style) {
  return <button className={buttonClass({ variant, size }, className)} {...props} />;
}

/** Link styled as a button (plain anchors for the editor, which loads fresh so its game engine starts clean) */
export function ButtonLink({ variant, size, className, href, external, ...props }: ComponentProps<"a"> & Style & { href: string; external?: boolean }) {
  if (external || href.startsWith("/editor") || href.startsWith("http")) {
    return <a href={href} className={buttonClass({ variant, size }, className)} {...props} />;
  }
  return <Link href={href} className={buttonClass({ variant, size }, className)} {...props} />;
}
