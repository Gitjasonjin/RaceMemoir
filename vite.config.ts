import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // Worker-only dependencies must not trigger a page reload on the first cutout.
  optimizeDeps: {include:['@imgly/background-removal','onnxruntime-web','onnxruntime-web/webgpu']},
  server: { host: '0.0.0.0', port: 5173 },
})
