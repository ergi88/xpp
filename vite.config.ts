import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import os from "os";

export default defineConfig({
  base: "/xpp/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/script\.google\.com\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
      manifest: {
        name: "Finix",
        short_name: "Finix",
        description: "Personal finance tracker",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        start_url: "/xpp/",
        icons: [
          {
            src: "icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
    {
      name: "show-local-ip",
      configureServer(server) {
        // when the dev server starts listening, print a local IP to use from mobile
        server.httpServer?.on("listening", () => {
          const interfaces = os.networkInterfaces();
          const localIPs: string[] = [];
          for (const name of Object.keys(interfaces)) {
            const iface = interfaces[name];
            if (!iface) continue;
            for (const alias of iface) {
              if (alias.family === "IPv4" && !alias.internal) {
                localIPs.push(alias.address);
              }
            }
          }
          const port =
            (server.config &&
              server.config.server &&
              (server.config.server as any).port) ||
            5178;
          if (localIPs.length > 0) {
            console.log(
              `\n📱 Access from mobile: http://${localIPs[0]}:${port}/xpp/`,
            );
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify("dev"),
  },
  server: {
    port: 5178,
    allowedHosts: true,
  },
});
