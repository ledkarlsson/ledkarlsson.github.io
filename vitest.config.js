export default {
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      reporter: ["text", "html", "lcov"]
    }
  }
};
