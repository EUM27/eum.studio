import * as path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-electron/preload",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      entry: path.resolve(process.cwd(), "src/preload/index.ts"),
      formats: ["cjs"],
      fileName: () => "index.js",
    },
    rolldownOptions: {
      external: ["electron"],
    },
  },
});
