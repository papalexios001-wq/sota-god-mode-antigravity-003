import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ai': ['@anthropic-ai/sdk', '@google/genai', 'openai'],
          'vendor-editor': ['react-quill'],
        },
      },
    },
    
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  
  server: {
    port: 3000,
    host: true,
  },
  
  preview: {
    port: 4173,
    host: true,
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-quill'],
    exclude: ['@anthropic-ai/sdk'],
  },
  
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
