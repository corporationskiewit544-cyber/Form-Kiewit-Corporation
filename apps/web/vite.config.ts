import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev proxy is only used when VITE_API_URL is unset (local dev).
// Production builds call the API directly from the browser.
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
