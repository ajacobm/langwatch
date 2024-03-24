import { join } from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test-setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "**/*.integration.test.ts",
      ".next/**/*",
      ".next-saas/**/*",
    ],
  },
  resolve: {
    alias: {
      "~/": join(__dirname, "./src/"),
      "@injected-dependencies.client": join(
        __dirname,
        "./src/injection/injection.client.ts"
      ),
      "@injected-dependencies.server": join(
        __dirname,
        "./src/injection/injection.server.ts"
      ),
    },
  },
});
