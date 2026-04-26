import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/tradingdashboard/",
  plugins: [react()],
  server: {
    proxy: {
      // OpenFIGI: Umgehung möglicher Browser-CORS-Probleme nur in der Entwicklung
      "/openfigi": {
        target: "https://api.openfigi.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openfigi/, "")
      }
    }
  }
});
