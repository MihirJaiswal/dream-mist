import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { CSSProperties, ReactNode } from "react";

/** Docs layout: the site header on top, then the Fumadocs sidebar, page and table of contents, and the site footer */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <DocsLayout
        tree={source.getPageTree()}
        //Sidebar and table of contents stick below the site header (h-16 and its 3px border)
        containerProps={{ className: "docs-night", style: { "--fd-banner-height": "calc(4rem + 3px)" } as CSSProperties }}
        nav={{ title: <span className="font-pixel text-[13px] text-[#f06aa6]">Documentation</span>, url: "/docs" }}
        themeSwitch={{ enabled: false }}
      >
        {children}
      </DocsLayout>
      <SiteFooter />
    </>
  );
}
