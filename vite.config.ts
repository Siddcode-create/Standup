import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'

dotenv.config()

function standupApiPlugin(): Plugin {
  return {
    name: 'standup-api-dev',
    async configureServer(server) {
      const { createApp } = await import('./server/createApp.ts')
      server.middlewares.use(createApp())
      console.log('[standup-api] Dev API mounted at /api/*')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), standupApiPlugin()],
})
