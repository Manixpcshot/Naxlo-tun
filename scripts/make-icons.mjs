/**
 * Icon pipeline — renders the SVG masters in `build/` to every raster artefact
 * the desktop builds consume:
 *
 *   build/icon-source.png   2048²  (source of truth; tauri + store art)
 *   build/icon.png           512²  (Linux / generic)
 *   build/icon.ico        256…16   (Windows shell + installer)
 *   build/tray.png            32²  (tray in dev)
 *   build/tray.ico         64…16   (tray packaged)
 *
 * Needs `sharp` (SVG rasterisation) and ImageMagick (`convert`, ICO packing):
 *   npm i --no-save sharp
 * Then:  node scripts/make-icons.mjs
 * Finally regenerate the Tauri set from the new master:
 *   npx tauri icon build/icon-source.png -o tauri/icons
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const build = join(root, 'build')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('make-icons: `sharp` is missing — run: npm i --no-save sharp')
  process.exit(1)
}

const render = (svg, size) =>
  sharp(join(build, svg), { density: 384 }).resize(size, size, { fit: 'inside' }).png().toBuffer()

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'naxlo-icons-'))
  try {
    // ---- app icon
    await sharp(await render('icon-source.svg', 2048)).toFile(join(build, 'icon-source.png'))
    await sharp(await render('icon-source.svg', 512)).toFile(join(build, 'icon.png'))

    const icoSizes = [256, 128, 64, 48, 32, 16]
    const icoFiles = []
    for (const size of icoSizes) {
      const file = join(work, `app-${size}.png`)
      await sharp(await render('icon-source.svg', size)).toFile(file)
      icoFiles.push(file)
    }
    packIco(icoFiles, join(build, 'icon.ico'))

    // ---- tray icon
    await sharp(await render('tray-source.svg', 32)).toFile(join(build, 'tray.png'))
    const trayFiles = []
    for (const size of [64, 48, 32, 16]) {
      const file = join(work, `tray-${size}.png`)
      await sharp(await render('tray-source.svg', size)).toFile(file)
      trayFiles.push(file)
    }
    packIco(trayFiles, join(build, 'tray.ico'))

    // ---- GitHub social banner (SVG master references icon.png relatively)
    await sharp(join(build, 'banner-source.svg')).png().toFile(join(build, 'banner.png'))

    // ---- keep the Tauri UI favicon in sync with the Electron renderer's
    copyFileSync(
      join(root, 'src/renderer/src/assets/favicon.svg'),
      join(root, 'tauri/ui/favicon.svg')
    )

    console.log('make-icons: wrote icon-source.png, icon.png, icon.ico, tray.png, tray.ico, banner.png')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function packIco(pngs, out) {
  // PNG-compressed frames keep the gradients crisp (no palette quantisation).
  execFileSync('convert', [...pngs, out], { stdio: 'inherit' })
}

void main()
