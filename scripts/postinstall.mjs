/**
 * Naxlo post-install helper.
 *
 * Keeps the working tree ready for development without ever committing binary
 * artefacts. It is intentionally tiny and dependency free.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ensureDir = (p) => {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

ensureDir(join(root, 'resources', 'xray'))
const keep = join(root, 'resources', '.gitkeep')
if (!existsSync(keep)) writeFileSync(keep, '')

console.log(
  [
    '',
    '  naxlo — dependencies installed.',
    '',
    '  The Xray core binary is NOT bundled in Git. Fetch it with:',
    '',
    '      npm run xray:fetch',
    '',
    '  Then start the app with `npm run dev` or build installers with',
    '  `npm run dist:win`. On Windows the app can also download the core',
    '  automatically on first launch.',
    ''
  ].join('\n')
)
