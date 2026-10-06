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

const processEnvDefine = (envName: string): Record<string, string> => {
  return { [`process.env.${envName}`]: '"true"' }
}

export default defineConfig({
  main: {
    build: { externalizeDeps: false },
    define: {
      ...processEnvDefine('WS_NO_BUFFER_UTIL'),
      ...processEnvDefine('WS_NO_UTF_8_VALIDATE'),
    },
    plugins: [scopedSrcAliasPlugin()],
  },
  preload: {
    build: { externalizeDeps: false },
    plugins: [scopedSrcAliasPlugin()],
  },
  renderer: {
    plugins: [react(), scopedSrcAliasPlugin()],
    resolve: {
      alias: [{ find: '#resource', replacement: resolve('resource') }],
    },
  },
})
