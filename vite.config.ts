import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
