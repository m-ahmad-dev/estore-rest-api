import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended, // Basic good JavaScript rules
  {
    languageOptions: {
      globals: {
        ...globals.node, // Allows "process", "require", "__dirname" etc.
        ...globals.es2025, // Modern JS features
      },
      ecmaVersion: "latest",
      sourceType: "module", // Use import/export (recommended)
    },
    rules: {
      
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
      eqeqeq: "error", // Use === instead of ==
      curly: "error", // Always use braces {}
    },
    ignores: ["node_modules/", "dist/", "build/", "coverage/"],
  },
  prettier, // ← MUST be last! Disables conflicting rules
];
