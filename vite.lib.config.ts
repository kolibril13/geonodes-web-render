import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { version } from './package.json'

const reactExternalRegex = /^react(-dom)?(\/|$)/

export default defineConfig({
  publicDir: false,
  define: {
    __WEB_RENDER_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    dts({
      include: ['src/embed.tsx', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'src/dev-embed.tsx', 'src/components/**', 'src/**/*.test.*'],
      entryRoot: 'src',
      outDir: 'dist/types',
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
    alias: [
      { find: /^use-sync-external-store\/shim\/with-selector(\.js)?$/, replacement: resolve(__dirname, 'src/shims/use-sync-external-store-shim-with-selector.ts') },
      { find: /^use-sync-external-store\/shim(\/index)?(\.js)?$/, replacement: resolve(__dirname, 'src/shims/use-sync-external-store-shim.ts') },
    ],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/embed.tsx'),
      name: 'GeonodesWebRender',
      formats: ['es'],
      fileName: 'embed',
    },
    rollupOptions: {
      external: (id) => reactExternalRegex.test(id),
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    outDir: 'dist',
    sourcemap: false,
  },
})
