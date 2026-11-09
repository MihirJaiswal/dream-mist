import "./globals.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { ScrollbarActivity } from "@/components/scrollbars";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Pixelify_Sans, Silkscreen } from "next/font/google";
import type { ReactNode } from "react";
import { repoUrl, siteDescription, siteName, siteTitle, siteUrl } from "@/lib/site";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });
const pixel = Silkscreen({ subsets: ["latin"], weight: ["400"], variable: "--font-silkscreen" });
const game = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixelify" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: `%s | ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "Pokémon game maker",
    "make your own Pokémon game",
    "Pokémon fan game",
    "Gen 3",
    "Pokémon Emerald",
    "RPG maker",
    "browser game maker",
    "pixel art",
  ],
  category: "games",
  icons: { icon: "/site/dreammist.png", apple: "/site/dreammist.png" },
  openGraph: { type: "website", siteName, locale: "en_US", title: siteTitle, description: siteDescription },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription },
};

export const viewport: Viewport = { themeColor: "#140b2a", colorScheme: "dark" };

/** What search engines read about the site: its name (for the result title), the free browser game maker it is, and who made it (the same Person as on mihirjaiswal.com) */
const person = "https://mihirjaiswal.com/#person";
const structured = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: siteName,
      description: siteDescription,
      inLanguage: "en",
      author: { "@id": person },
    },
    {
      "@type": ["VideoGame", "WebApplication"],
      "@id": `${siteUrl}/#game`,
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      author: { "@id": person },
      applicationCategory: "GameApplication",
      operatingSystem: "Any (runs in the browser)",
      browserRequirements: "Requires JavaScript and WebGL",
      gamePlatform: "Web browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      image: `${siteUrl}/opengraph-image`,
      sameAs: [repoUrl],
      isPartOf: { "@id": `${siteUrl}/#website` },
    },
    { "@type": "Person", "@id": person, name: "Mihir Jaiswal", url: "https://mihirjaiswal.com", sameAs: ["https://github.com/mihirjaiswal"] },
  ],
};

/** Root layout (dark only, like the editor) */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${plex.variable} ${mono.variable} ${pixel.variable} ${game.variable}`} suppressHydrationWarning>
      <head>
        {/* Pokémon sprites come from PokeAPI's GitHub: open the connection early */}
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
      </head>
      <body className="min-h-screen">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
        <RootProvider theme={{ forcedTheme: "dark", defaultTheme: "dark" }} search={{ options: { type: "static" } }}>
          {children}
        </RootProvider>
        <ScrollbarActivity />
      </body>
    </html>
  );
}
