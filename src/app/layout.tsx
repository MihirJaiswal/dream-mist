import "./globals.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Pixelify_Sans, Silkscreen } from "next/font/google";
import type { ReactNode } from "react";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });
const pixel = Silkscreen({ subsets: ["latin"], weight: ["400"], variable: "--font-silkscreen" });
const game = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-pixelify" });

export const metadata: Metadata = {
  title: { default: "DreamMist: build your own Pokémon town", template: "%s | DreamMist" },
  description: "Build a Pokémon town with real Gen 3 tiles, write a little story, and share it with friends to play, like and fork.",
  icons: { icon: "/site/dreammist.png" },
};

/** Root layout (dark only, like the editor) */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${plex.variable} ${mono.variable} ${pixel.variable} ${game.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <RootProvider theme={{ forcedTheme: "dark", defaultTheme: "dark" }} search={{ options: { type: "static" } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
