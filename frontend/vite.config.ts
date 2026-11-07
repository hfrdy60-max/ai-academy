import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// base "./" = relative asset paths, so the site works under
// https://USER.github.io/REPO/ without knowing the repository name.
// The app uses HashRouter, so GitHub Pages never needs server rewrites.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "./",
        name: "آکادمی هوش مصنوعی",
        short_name: "آکادمی AI",
        description: "پلتفرم آموزشی تعاملی با هوش مصنوعی",
        lang: "fa",
        dir: "rtl",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        categories: ["education"],
        background_color: "#0b1020",
        theme_color: "#4f46e5",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Pre-cache the whole app shell + fonts so saved lessons open offline.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true
      }
    })
  ]
});
