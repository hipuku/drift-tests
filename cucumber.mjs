// Cucumber configuration. TypeScript step definitions and support code are
// loaded through tsx (registered via NODE_OPTIONS in the npm scripts), so the
// features run straight off the source with no build step.
export default {
  paths: ["features/**/*.feature"],
  import: ["features/support/**/*.ts", "features/steps/**/*.ts"],
  format: ["progress-bar", "summary"],
  formatOptions: { snippetInterface: "async-await" },
  // The step timeout is set with setDefaultTimeout() in features/support/hooks.ts
  // (a crawl round-trips through Playwright + Redis). The config has no such key.
};
