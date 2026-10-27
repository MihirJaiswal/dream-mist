import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      //Pixel art is served as it is (images.unoptimized), so plain <img> is intended
      "@next/next/no-img-element": "off",
      //Names starting with _ are deliberately unused (skipped tuple items, required parameters)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    //Leaving the editor uses a full page load so the game engine stops
    files: ["src/components/editor/**"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  globalIgnores([
    ".next/**",
    ".source/**",
    ".cache/**",
    ".claude/**",
    ".kilo/**",
    "out/**",
    "public/**",
    "maps/**",
    "copyrighted/**",
    "next-env.d.ts",
  ]),
]);
