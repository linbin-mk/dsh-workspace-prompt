import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

/**
 * Dual build:
 *  - the host half (`src/index.ts` -> `lib/index.js`) stays ESM for the Node
 *    Cordis loader, with the private `@deepseek-ai` peer packages external;
 *  - the client half (`src/client/index.ts` -> `lib/client.js`) is emitted as a
 *    CJS bundle wrapped in `window.__ModuleLoader__.load({ id, factory })`, the
 *    exact shape the web client-modules loader expects for a third-party plugin
 *    (it injects the bundle as a classic script with a `require` shim that
 *    answers the runtime externals from the module table).
 *
 * CSS Modules are compiled inside the client bundle by {@link cssModulesPlugin}:
 * each `*.module.css` becomes a JS module that injects one `<style data-plugin>`
 * tag and exports the local -> scoped class map. Every class is prefixed with
 * `wsp-`, so a plugin stylesheet can never collide with another plugin's or with
 * the shell's global classes.
 */

const PLUGIN_ID = '@linbin-mk/dsh-workspace-prompt'
const PEER_EXTERNALS = [/^@deepseek-ai\//, 'react', 'react-dom', 'react/jsx-runtime']

/** Virtual module id prefix/suffix for a compiled stylesheet. */
const CSS_VIRTUAL_PREFIX = '\0wsp-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Package root, used to keep virtual ids package-relative (no build path in the bundle). */
const BUNDLE_ROOT = dirname(fileURLToPath(import.meta.url))

/** One dotted class selector in the plugin stylesheet. */
const CLASS_SELECTOR = /\.(-?[_a-zA-Z][\w-]*)/g

/**
 * Resolve an imported `*.module.css` to a virtual module that injects the
 * stylesheet and exports its class map.
 *
 * Deliberately dependency-free: the stylesheet is authored here, so scoping is
 * one deterministic prefix (`wsp-`) instead of a content hash, and selectors
 * that only this file uses stay readable in DevTools.
 * @returns the bundler plugin.
 */
function cssModulesPlugin(): {
  name: string
  resolveId: (source: string, importer: string | undefined) => string | null
  load: (id: string) => Promise<string | null>
} {
  return {
    name: 'dsh-css-modules-inline',
    resolveId(source, importer) {
      if (!source.endsWith('.module.css')) return null
      const absolute = importer === undefined
        ? resolvePath(source)
        : resolvePath(dirname(importer), source)
      // Relative on purpose: the bundler prints module ids in `//#region`
      // comments, so an absolute id would bake the builder's path into the
      // published bundle.
      return CSS_VIRTUAL_PREFIX + relative(BUNDLE_ROOT, absolute) + CSS_VIRTUAL_SUFFIX
    },
    async load(id) {
      if (!id.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const relativeId = id.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      const fileId = resolvePath(BUNDLE_ROOT, relativeId)
      this.addWatchFile(fileId)
      const source = await readFile(fileId, 'utf8')
      const classMap: Record<string, string> = {}
      const css = source.replace(CLASS_SELECTOR, (_match, local: string) => {
        const scoped = `wsp-${local}`
        classMap[local] = scoped
        return `.${scoped}`
      })
      const exports = Object.fromEntries(Object.keys(classMap).sort().map(local => [local, classMap[local]]))
      const tagId = `${PLUGIN_ID}/${basename(fileId)}`
      // Idempotent under re-evaluation: one style tag per stylesheet.
      return [
        `const css = ${JSON.stringify(css)};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css="\' + tagId + \'"]\') === null) {',
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(exports)};`,
      ].join('\n')
    },
  }
}

export default defineConfig([
  {
    name: 'host',
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    platform: 'node',
    outDir: 'lib',
    dts: false,
    clean: false,
    install: false,
    deps: { neverBundle: PEER_EXTERNALS },
    outExtensions: () => ({ js: '.js' }),
  },
  {
    name: 'client',
    entry: { client: 'src/client/index.ts' },
    format: 'cjs',
    platform: 'browser',
    outDir: 'lib',
    dts: false,
    clean: false,
    install: false,
    plugins: [cssModulesPlugin()],
    deps: { neverBundle: PEER_EXTERNALS },
    outExtensions: () => ({ js: '.js' }),
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
