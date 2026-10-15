import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Con el stack levantado en Docker, `npm run dev` habla con el proxy de :8080.
    proxy: { '/api': 'http://localhost:8080' },
  },
});
