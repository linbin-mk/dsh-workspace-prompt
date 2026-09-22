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
 */

const PEER_EXTERNALS = [/^@deepseek-ai\//, 'react', 'react-dom', 'react/jsx-runtime']

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
    deps: { neverBundle: PEER_EXTERNALS },
    outExtensions: () => ({ js: '.js' }),
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@linbin-mk/dsh-workspace-prompt", factory: (require) => {',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
