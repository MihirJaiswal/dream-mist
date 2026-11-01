"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle, CircleNotch, Info, Warning, X, XCircle } from "@phosphor-icons/react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** shadcn toaster styled with the editor's tokens (sonner's own look is turned off) */
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      gap={10}
      offset={16}
      mobileOffset={12}
      icons={{
        success: <CheckCircle weight="fill" className="size-[18px]" />,
        info: <Info weight="fill" className="size-[18px]" />,
        warning: <Warning weight="fill" className="size-[18px]" />,
        error: <XCircle weight="fill" className="size-[18px]" />,
        loading: <CircleNotch className="size-[18px] animate-spin" />,
        close: <X className="size-3.5" />,
      }}
      toastOptions={{
        unstyled: true,
        ...toastOptions,
        classNames: {
          toast:
            "group/toast relative flex w-[var(--width)] items-start gap-3 rounded-lg border border-border bg-card p-3.5 pr-9 font-sans text-card-foreground shadow-[0_10px_32px_-8px_rgb(0_0_0/0.7)] ring-1 ring-black/40",
          icon: "mt-px flex shrink-0 text-muted-foreground",
          content: "grid min-w-0 flex-1 gap-0.5",
          title: "text-sm font-medium leading-5",
          description: "text-[13px] leading-5 text-muted-foreground",
          actionButton: cn(buttonVariants({ size: "xs" }), "mt-px shrink-0"),
          cancelButton: cn(buttonVariants({ variant: "ghost", size: "xs" }), "mt-px shrink-0"),
          closeButton:
            "absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-md text-muted-foreground opacity-70 transition hover:bg-accent hover:text-foreground hover:opacity-100",
          success: "[&_[data-icon]]:text-success",
          info: "[&_[data-icon]]:text-sky-400",
          warning: "[&_[data-icon]]:text-amber-400",
          error: "[&_[data-icon]]:text-destructive",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
