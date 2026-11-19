import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiDevPlugin } from './server/dev/apiDevPlugin.ts'

// Vite settings. Tailwind runs through postcss.config.js (see tailwind.config.js).
// apiDevPlugin runs the api/ functions during `npm run dev` (Vercel runs them in production).
export default defineConfig({
  plugins: [react(), apiDevPlugin()],
})
