import { Ledge } from "@/components/site/landing/pixel";
import { edit } from "@/lib/api";
import Link from "next/link";

/** Footer link columns */
const columns = [
  {
    title: "Play",
    links: [
      { href: "/explore", label: "Explore games" },
      { href: edit(), label: "Open the editor" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/docs/first-game", label: "Your first game" },
      { href: "/docs", label: "Docs" },
      { href: "/docs/shortcuts", label: "Keyboard shortcuts" },
    ],
  },
];

/** Site footer: the ground the night sky ends on */
export function SiteFooter() {
  return (
    <footer className="night">
      <Ledge />
      <div className="bg-[#0d0720]">
        <div className="grid gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr] md:px-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <img src="/site/dreammist.png" alt="" width={28} height={28} className="pixelated" />
              <span className="font-pixel text-[20px] text-[#f06aa6] [text-shadow:2px_2px_0_#4a1640]">DreamMist</span>
            </Link>
            <p className="mt-3 max-w-[36ch] font-game text-[15px] leading-relaxed text-[#c9b8f5]">
              A fan-made Pokémon game maker for friends. Make a game, then let them play it.
            </p>
          </div>
          {columns.map(({ title, links }) => (
            <nav key={title} aria-label={title}>
              <p className="font-pixel text-[12px] uppercase tracking-wide text-white">{title}</p>
              <ul className="mt-4 grid gap-2.5">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    {href.startsWith("/editor") ? (
                      <a href={href} className="font-game text-[15px] text-[#c9b8f5] hover:text-[#f06aa6]">
                        {label}
                      </a>
                    ) : (
                      <Link href={href} className="font-game text-[15px] text-[#c9b8f5] hover:text-[#f06aa6]">
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t-[3px] border-dashed border-[#2d1a52]">
          <p className="px-4 py-6 font-game text-[13px] text-[#8a7bb8] md:px-8">
            Pokémon and its assets belong to Nintendo, Game Freak and The Pokémon Company. This is a non-commercial fan project.
          </p>
        </div>
      </div>
    </footer>
  );
}
