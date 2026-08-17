import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { version } from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  base: "/geonodes-web-render/",
  define: {
    __WEB_RENDER_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
