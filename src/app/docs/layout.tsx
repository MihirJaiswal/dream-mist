import { SiteHeader } from "@/components/site/site-header";
import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { CSSProperties, ReactNode } from "react";

/** Docs layout: the site header on top, then the Fumadocs sidebar, page and table of contents */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <DocsLayout
        tree={source.getPageTree()}
        //Sidebar and table of contents stick below the site header (h-14)
        containerProps={{ style: { "--fd-banner-height": "3.5rem" } as CSSProperties }}
        nav={{ title: <span className="text-[13px] font-medium">Documentation</span>, url: "/docs" }}
        themeSwitch={{ enabled: false }}
      >
        {children}
      </DocsLayout>
    </>
  );
}
