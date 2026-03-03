import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare var process: any;

export default defineConfig({
  plugins: [react()],
  define: {
    // Permet d'utiliser process.env.API_KEY dans le code frontend
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});