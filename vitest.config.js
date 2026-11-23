export default {
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/extension-tests/**"],
    coverage: {
      reporter: ["text", "html", "lcov"]
    }
  }
};
