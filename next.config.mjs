import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { createMDX } from "fumadocs-mdx/next";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  images: { unoptimized: true },
  //Links shared before the editor moved to /editor (the #visit=… part is kept by the browser)
  redirects: async () => [{ source: "/city.html", destination: "/editor", permanent: true }],
};

export default createMDX()(config);

//Gives `next dev` the Cloudflare bindings from wrangler.jsonc
initOpenNextCloudflareForDev();
