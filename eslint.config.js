const browserGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  File: "readonly",
  Image: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  createImageBitmap: "readonly",
  crypto: "readonly",
  document: "readonly",
  fetch: "readonly",
  localStorage: "readonly",
  navigator: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["src/**/*.js", "src/**/*.jsx", "ErrorBoundary.jsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: browserGlobals,
    },
    rules: {
      "no-debugger": "error",
      "no-dupe-keys": "error",
      "no-constant-condition": "error",
      "no-unreachable": "error",
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "valid-typeof": "error",
    },
  },
];
