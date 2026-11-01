/**
 * Tauri entry point.
 *
 * Installs the `window.naxlo` shim first, then boots the exact same React
 * application the Electron build uses — one UI, two backends.
 */
import './shim'
import '../../src/renderer/src/main'
