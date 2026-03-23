import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/static/raio-x/',
  build: {
    outDir: '../rotas/static/raio-x',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'raio-x.js',
        chunkFileNames: 'raio-x-[name].js',
        assetFileNames: (info) => {
          if (info.name && info.name.endsWith('.css')) return 'raio-x.css'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
