import { LoginHost } from "@/components/login";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Toaster } from "@/components/ui/sonner";
import { repoUrl, siteDescription, siteName, siteUrl } from "@/lib/site";
import type { ReactNode } from "react";

/** What search engines read about the site: its name (for the result title) and the free browser app it is */
const structured = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: siteUrl, name: siteName, description: siteDescription, inLanguage: "en" },
    {
      "@type": "WebApplication",
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      applicationCategory: "GameApplication",
      operatingSystem: "Any (runs in the browser)",
      browserRequirements: "Requires JavaScript and WebGL",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      image: `${siteUrl}/opengraph-image`,
      sameAs: [repoUrl],
      isPartOf: { "@id": `${siteUrl}/#website` },
    },
  ],
};

/** Landing and Explore layout */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
      <SiteHeader />
      <main className="night">{children}</main>
      <SiteFooter />
      <Toaster position="bottom-right" closeButton />
      <LoginHost />
    </>
  );
}
