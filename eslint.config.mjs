import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party copies, not this repo's source. Both are gitignored
    // and reinstalled wholesale, so their lint warnings are noise nobody can
    // act on — 152 of them, which buried anything real in `npm run lint`.
    ".claude/skills/**",
    ".impeccable/**",
  ]),
]);

export default eslintConfig;
