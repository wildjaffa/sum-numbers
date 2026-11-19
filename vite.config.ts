import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["Sum-Numbers-Logo.png", "favicon.svg", "icons.svg"],
      manifest: {
        name: "Sum Numbers",
        short_name: "SumNumbers",
        description: "Solve grid sum puzzles by keeping or erasing numbers.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          {
            src: "/Sum-Numbers-Logo.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/Sum-Numbers-Logo.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // Precache built assets and fall back to index.html for navigations
        // so the installed app still opens when the origin is unreachable.
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
    }),
  ],
});
