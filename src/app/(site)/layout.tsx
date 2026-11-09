import { LoginHost } from "@/components/login";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";

/** Landing and Explore layout */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="night">{children}</main>
      <SiteFooter />
      <Toaster position="bottom-right" closeButton />
      <LoginHost />
    </>
  );
}
