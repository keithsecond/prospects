import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import stylistic from '@stylistic/eslint-plugin'


export default defineConfig([
    { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: { js, '@stylistic': stylistic },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.browser },
        rules: {
			      "consistent-return": 2,
			      "indent"           : [1, 4],
			      "no-else-return"   : 1,
			      @stylistic/semi': [1, "always"],
			      "space-unary-ops"  : 2
        }
    },
    { files: ["**/*.js"],
        languageOptions: { sourceType: "script" } },
    tseslint.configs.recommended,
]);
