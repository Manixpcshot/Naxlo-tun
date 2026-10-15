#!/usr/bin/env node
/**
 * Test runner.
 *
 * The tests import TypeScript modules directly, so they are bundled with Vite
 * (already a dev dependency) into `.tmp-tests/` and executed by plain Node —
 * no Electron, no browser, no extra toolchain.
 */
import { build } from 'vite'
import { pathToFileURL } from 'node:url'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = resolve(root, 'scripts/tests/smoke.ts')
const outDir = resolve(root, '.tmp-tests')

if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })

process.stdout.write('  bundling tests…\n')
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  resolve: {
    alias: {
      '@shared': resolve(root, 'src/shared'),
      '@main': resolve(root, 'src/main')
    }
  },
  build: {
    ssr: entry,
    outDir: '.tmp-tests',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: { output: { entryFileNames: 'smoke.mjs' } }
  }
})

const bundle = join(outDir, 'smoke.mjs')
if (!existsSync(bundle)) {
  process.stderr.write('  test bundle was not produced\n')
  process.exitCode = 1
} else {
  process.stdout.write('  running tests…\n')
  await import(pathToFileURL(bundle).href)
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
}
