import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// API target is configurable so the same build works locally and in Docker.
// - local dev:   http://localhost:3001
// - docker dev:  http://server:3001  (via VITE_API_PROXY)
const apiTarget = process.env.VITE_API_PROXY ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
});
