import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", ".npm-cache/**", "coverage/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-unused-vars": "off",
    },
  },
];

export default config;
