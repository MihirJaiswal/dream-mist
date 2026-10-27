import Link from "next/link";

/** Site footer */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 md:px-6 text-[13px] text-subtle-fg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <img src="/site/dreammist.png" alt="" width={20} height={20} className="pixelated" />
          <span>DreamMist, a fan-made Pokémon town builder for friends.</span>
        </div>
        <nav className="flex flex-wrap gap-4">
          <Link href="/explore" className="hover:text-fg">Explore</Link>
          <Link href="/docs" className="hover:text-fg">Docs</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-7xl px-4 md:px-6 pb-8 text-[12px] text-subtle-fg/80">Pokémon and its assets belong to Nintendo, Game Freak and The Pokémon Company. This is a non-commercial fan project.</p>
    </footer>
  );
}
