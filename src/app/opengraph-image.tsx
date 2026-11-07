import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "DreamMist: build your own Pokémon game, free in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link-preview picture every page shares: the dream sky, the logo and the headline (made once at build time) */
export default async function Image() {
  const picture = async (path: string) => `data:image/png;base64,${(await readFile(join(process.cwd(), "public", path))).toString("base64")}`;
  const [sky, logo] = await Promise.all([picture("site/loaderbg.png"), picture("site/dreammist.png")]);
  return new ImageResponse(
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
      <img src={sky} alt="" width={1200} height={675} style={{ position: "absolute", top: -20, left: 0 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "44px 72px",
          background: "rgba(20, 11, 42, 0.86)",
          border: "6px solid #f06aa6",
          boxShadow: "12px 12px 0 #4a1640",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={logo} alt="" width={96} height={96} style={{ imageRendering: "pixelated" }} />
          <span style={{ fontSize: 96, fontWeight: 700, color: "#f06aa6", textShadow: "6px 6px 0 #4a1640", letterSpacing: -2 }}>DreamMist</span>
        </div>
        <span style={{ marginTop: 16, fontSize: 52, fontWeight: 700, color: "#ffffff" }}>Build your own Pokémon game.</span>
        <span style={{ marginTop: 18, fontSize: 30, color: "#c9b8f5" }}>Towns, routes, trainers, gyms and a story. Free, in your browser.</span>
      </div>
    </div>,
    size,
  );
}
