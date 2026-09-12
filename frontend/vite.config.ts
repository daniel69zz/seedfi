import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],

  server: {
    // Barretenberg genera la prueba usando varios hilos, y `SharedArrayBuffer`
    // —que es como se los comunica— solo existe en un contexto con aislamiento
    // de origen cruzado. Sin estas dos cabeceras el navegador lo deja en
    // `undefined` y bb.js falla al inicializar, sin decir por qué.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      // El backend queda detrás del mismo origen: así el navegador no necesita
      // preflight de CORS y, sobre todo, las respuestas no chocan con la COEP
      // de arriba (un recurso de otro origen sin CORP queda bloqueado).
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },

  optimizeDeps: {
    // Estos dos traen WASM y workers. Si esbuild los pre-empaqueta, los
    // `new Worker(new URL(...))` se reescriben mal y el prover no arranca.
    exclude: ['@aztec/bb.js', '@noir-lang/noir_js', '@noir-lang/acvm_js', '@noir-lang/noirc_abi'],
  },

  worker: { format: 'es' },

  build: {
    target: 'esnext', // bb.js usa top-level await
  },
})
