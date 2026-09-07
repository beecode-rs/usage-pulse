import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const scopedSrcAliasPlugin = (): Plugin => {
  return {
    enforce: 'pre',
    name: 'scoped-src-alias',
    resolveId(source, importer) {
      const isSrcImport = source === '#src' || source.startsWith('#src/')
      const isFromNodeModules = importer?.includes('node_modules') ?? false

      if (!isSrcImport || isFromNodeModules) {
        return null
      }

      return this.resolve(source.replace(/^#src/, resolve('src')), importer, { skipSelf: true })
    },
  }
}

export default defineConfig({
  main: {
    build: { externalizeDeps: true },
    resolve: { alias: [{ find: '#src', replacement: resolve('src') }] },
  },
  preload: {
    build: { externalizeDeps: true },
    resolve: { alias: [{ find: '#src', replacement: resolve('src') }] },
  },
  renderer: {
    plugins: [react(), scopedSrcAliasPlugin()],
    resolve: {
      alias: [{ find: '#resource', replacement: resolve('resource') }],
    },
  },
})
