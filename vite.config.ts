import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/depthmapphoto/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@react-three/fiber',
      '@react-three/drei',
      'three'
    ],
  },
  build: {
    target: 'esnext',
  },
})
