import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api/* is proxied to the FastAPI backend (uvicorn backend.main:app --port 8000).
// In production (Docker/Render) the build in dist/ is copied to ./static and served by FastAPI
// on the same origin, so the relative "/api" path just works.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_PROXY_TARGET || "http://localhost:8000",
    },
  },
});
