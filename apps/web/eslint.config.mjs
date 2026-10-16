import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const restrict = (groups) => [
  "error",
  {
    patterns: [
      {
        group: [...groups, "../**"],
        message:
          "Respect documented layer ownership and use @/ aliases for cross-directory imports.",
      },
    ],
  },
];
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict([
        "@/features/**",
        "@/app/**",
        "@/services/**",
        "@/components/layout/**",
      ]),
    },
  },
  {
    files: ["src/components/layout/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict([
        "@/features/**",
        "@/app/**",
        "@/services/**",
      ]),
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict([
        "react",
        "react-dom",
        "next/**",
        "@/components/**",
        "@/features/**",
        "@/app/**",
        "@/services/**",
      ]),
    },
  },
  {
    files: ["src/features/marketing/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict([
        "@/features/design-system/**",
        "@/app/**",
      ]),
    },
  },
  {
    files: ["src/features/design-system/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict([
        "@/features/marketing/**",
        "@/app/**",
      ]),
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
