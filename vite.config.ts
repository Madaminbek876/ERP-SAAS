import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/")

          if (normalizedId.includes("/node_modules/")) {
            if (
              normalizedId.includes("/@tanstack/") ||
              normalizedId.includes("/axios/") ||
              normalizedId.includes("/react-toastify/")
            ) {
              return "vendor-data"
            }

            if (
              normalizedId.includes("/@radix-ui/") ||
              normalizedId.includes("/radix-ui/") ||
              normalizedId.includes("/lucide-react/") ||
              normalizedId.includes("/recharts/")
            ) {
              return "vendor-ui"
            }

            return "vendor"
          }

          return undefined
        },
      },
    },
  },
})
