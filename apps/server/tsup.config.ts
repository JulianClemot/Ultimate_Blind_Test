import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Workspace packages are consumed from TypeScript source: bundle them.
  noExternal: [/^@ubt\//],
  // Keep `node:` prefixes: some built-ins (node:sqlite) only exist under the prefix.
  removeNodeProtocol: false,
});
