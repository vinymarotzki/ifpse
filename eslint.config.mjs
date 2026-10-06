import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores(["**/.next/**", "**/node_modules/**", "next-env.d.ts"]),
];

export default eslintConfig;
