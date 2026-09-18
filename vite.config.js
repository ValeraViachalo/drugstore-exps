import { defineConfig } from 'vite'
import { cpSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Папки, які НЕ є експериментами і не мають потрапляти в dist/.
const EXCLUDE = new Set([
  'node_modules', 'dist', '.git', '.vercel', '.vscode',
  'drugstore-preview-generator',
  'previews', // прев'ю підхоплює сам Vite через <img src> в index.html
])

// Усі інші папки в корені (експерименти) копіюються в dist/ як є.
function copyExperiments() {
  return {
    name: 'copy-experiments',
    apply: 'build',
    closeBundle() {
      const root = process.cwd()
      for (const name of readdirSync(root)) {
        if (EXCLUDE.has(name) || name.startsWith('.')) continue
        if (!statSync(join(root, name)).isDirectory()) continue
        cpSync(join(root, name), join(root, 'dist', name), {
          recursive: true,
          filter: (src) => !/(^|\/)(\.DS_Store|node_modules|\.git)(\/|$)/.test(src),
        })
      }
    },
  }
}

export default defineConfig({
  publicDir: false,
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [copyExperiments()],
})
