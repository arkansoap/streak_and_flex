import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En dev, Vite sert le front sur 5180 et relaie /api vers Django (8010).
// Même origine côté navigateur → pas de CORS à gérer. En prod c'est nginx qui joue ce rôle.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      "/api": { target: "http://localhost:8010", changeOrigin: true },
    },
  },
});
