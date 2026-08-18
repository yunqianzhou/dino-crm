import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 项目站点通过 /<仓库名>/ 提供服务。
  base: '/dino-crm/',
  plugins: [react()],
  server: { port: 5180 },
})
