import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  publicDir: false,
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    dts({
      include: ['src/embed.tsx', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'src/components/**'],
      entryRoot: 'src',
      outDir: 'dist/types',
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/embed.tsx'),
      name: 'GeonodesWebRender',
      formats: ['es'],
      fileName: 'embed',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
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
