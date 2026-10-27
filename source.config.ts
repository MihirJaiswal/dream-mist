import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/** Docs collection (content/docs/*.mdx) */
export const docs = defineDocs({ dir: "content/docs" });

export default defineConfig();
